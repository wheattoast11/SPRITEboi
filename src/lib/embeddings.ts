import { 
  pipeline,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  cos_sim
} from "@huggingface/transformers";
import { SamModel, AutoProcessor } from "@huggingface/transformers";

const EMBED_DIM = 512;

class SemanticSearchPipeline {
  static model_id = "Xenova/clip-vit-base-patch16";
  static sam_model_id = "Xenova/slimsam-77-uniform";
  static instance = null;
  static sam_model = null;
  static sam_processor = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      const [tokenizer, model] = await Promise.all([
        AutoTokenizer.from_pretrained(this.model_id, { progress_callback }),
        CLIPTextModelWithProjection.from_pretrained(this.model_id, { 
          progress_callback,
          dtype: "fp32",
          device: !!navigator.gpu ? "webgpu" : "wasm"
        })
      ]);
      
      this.instance = { tokenizer, model };
      
      // Initialize SAM model
      this.sam_model = await SamModel.from_pretrained(this.sam_model_id, {
        dtype: "fp16",
        device: "webgpu"
      });
      this.sam_processor = await AutoProcessor.from_pretrained(this.sam_model_id);
    }
    return this.instance;
  }
  
  static async getSamModel() {
    if (!this.sam_model) {
      await this.getInstance();
    }
    return { model: this.sam_model, processor: this.sam_processor };
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const { tokenizer, model } = await SemanticSearchPipeline.getInstance();
  
  const text_inputs = await tokenizer(text, {
    padding: true,
    truncation: true
  });
  
  const { text_embeds } = await model(text_inputs);
  return Array.from(text_embeds.data);
}

export async function segmentImage(imageData: Uint8Array): Promise<{
  masks: Uint8Array[];
  scores: number[];
}> {
  const { model, processor } = await SemanticSearchPipeline.getSamModel();
  
  const image = await processor(imageData);
  const embeddings = await model.get_image_embeddings(image);
  
  // Auto-detect points for segmentation
  const points = await model.generate_points(embeddings);
  const { pred_masks, iou_scores } = await model({
    ...embeddings,
    ...points
  });
  
  // Post-process masks
  const masks = await processor.post_process_masks(
    pred_masks,
    image.original_sizes,
    image.reshaped_input_sizes
  );
  
  return {
    masks: masks.map(mask => new Uint8Array(mask.data)),
    scores: Array.from(iou_scores.data)
  };
}

export async function semanticSearch(
  db: any,
  query: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<any[]> {
  // Generate text embedding
  const embedding = await generateEmbedding(query);
  
  // Search using cosine similarity
  const result = await db.query(
    `SELECT id, prompt, type, content, created_at,
            1 - (embedding <=> $1::vector) as similarity
     FROM generations 
     WHERE 1 - (embedding <=> $1::vector) > $2
    AND type = 'image'
     ORDER BY similarity DESC
     LIMIT $3`,
    [embedding, threshold, limit]
  );
  
  // For each result, segment the image and add object metadata
  const enhancedResults = await Promise.all(
    result.rows.map(async (row) => {
      const { masks, scores } = await segmentImage(row.content);
      return {
        ...row,
        objects: masks.map((mask, i) => ({
          mask,
          score: scores[i]
        }))
      };
    })
  );
  
  return enhancedResults;
}