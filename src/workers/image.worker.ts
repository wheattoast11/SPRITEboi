import {
  AutoProcessor,
  MultiModalityCausalLM,
  BaseStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

const IMAGE_GENERATION_COMMAND_PREFIX = "/imagine ";
const stopping_criteria = new InterruptableStoppingCriteria();

class ImageGenerationPipeline {
  static model_id = "onnx-community/Janus-Pro-1B-ONNX";
  static processor: any = null;
  static model: MultiModalityCausalLM | null = null;

  static async getInstance(progress_callback = null) {
    this.processor ??= AutoProcessor.from_pretrained(this.model_id, {
      progress_callback,
    });

    this.model ??= MultiModalityCausalLM.from_pretrained(this.model_id, {
      progress_callback,
    });

    return Promise.all([this.processor, this.model]);
  }
}

async function generate(prompt: string) {
  const [processor, model] = await ImageGenerationPipeline.getInstance();

  const conversation = [
    {
      role: "<|User|>",
      content: prompt,
    },
  ];
  
  const inputs = await processor(conversation, {
    chat_template: "text_to_image",
  });

  const outputs = await model.generate_images({
    ...inputs,
    min_new_tokens: processor.num_image_tokens,
    max_new_tokens: processor.num_image_tokens,
    do_sample: true,
  });

  return outputs[0].toBlob();
}

self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      try {
        await ImageGenerationPipeline.getInstance((x) => {
          self.postMessage({ status: "progress", data: x });
        });
        self.postMessage({ status: "ready" });
      } catch (error) {
        self.postMessage({ status: "error", error: error.message });
      }
      break;

    case "generate":
      try {
        const blob = await generate(data.prompt);
        self.postMessage({ status: "complete", blob });
      } catch (error) {
        self.postMessage({ status: "complete", error: error.message });
      }
      break;

    case "interrupt":
      stopping_criteria.interrupt();
      break;
  }
});