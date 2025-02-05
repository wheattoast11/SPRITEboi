import {
  env,
  AutoTokenizer,
  MusicgenForConditionalGeneration,
  BaseStreamer,
} from "@huggingface/transformers";
import { encodeWAV } from "../utils/audio";

env.backends.onnx.wasm.proxy = true;

const MODEL_ID = "Xenova/musicgen-small";

class ProgressStreamer extends BaseStreamer {
  constructor(callback_fn: (value?: any) => void) {
    super();
    this.callback_fn = callback_fn;
  }

  callback_fn: (value?: any) => void;

  put(value: any) {
    return this.callback_fn(value);
  }

  end() {
    return this.callback_fn();
  }
}

class MusicGenerationPipeline {
  static model: MusicgenForConditionalGeneration | null = null;
  static tokenizer: any = null;

  static async getInstance(progress_callback = null) {
    this.tokenizer ??= AutoTokenizer.from_pretrained(MODEL_ID);

    this.model ??= MusicgenForConditionalGeneration.from_pretrained(MODEL_ID, {
      progress_callback,
      dtype: {
        text_encoder: "q8",
        decoder_model_merged: "q8",
        encodec_decode: "fp32",
      },
      device: "wasm",
    });

    return Promise.all([this.tokenizer, this.model]);
  }
}

async function generate(prompt: string, duration: number, temperature: number) {
  const [tokenizer, model] = await MusicGenerationPipeline.getInstance();

  // Calculate tokens based on duration
  const max_length = Math.min(
    Math.max(Math.floor(duration * 50), 1) + 4,
    model.generation_config.max_length ?? 1500
  );

  // Tokenize input text
  const inputs = tokenizer(prompt);

  // Generate music
  const audio_values = await model.generate({
    ...inputs,
    max_length,
    temperature,
    do_sample: true,
  });

  // Encode to WAV
  const sampling_rate = model.config.audio_encoder.sampling_rate;
  const wav = encodeWAV(audio_values.data, sampling_rate);
  return new Blob([wav], { type: "audio/wav" });
}

self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      try {
        await MusicGenerationPipeline.getInstance((x) => {
          self.postMessage({ status: "progress", data: x });
        });
        self.postMessage({ status: "ready" });
      } catch (error) {
        self.postMessage({ status: "error", error: error.message });
      }
      break;

    case "generate":
      try {
        const blob = await generate(data.prompt, data.duration, data.temperature);
        self.postMessage({ status: "complete", blob });
      } catch (error) {
        self.postMessage({ status: "complete", error: error.message });
      }
      break;
  }
});