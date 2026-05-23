/**
 * Nova Image Generation Tool
 * Supports: Replicate, OpenAI DALL-E, Stable Diffusion
 * Ported from Hermes Agent image_generation_tool.py
 */

import { env } from "node:process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type ImageProvider = "replicate" | "openai" | "sd" | "prodia";

export interface ImageGenOptions {
  prompt: string;
  provider?: ImageProvider;
  model?: string;
  width?: number;
  height?: number;
  negativePrompt?: string;
  outputFile?: string;
}

const OUTPUT_DIR = join(process.cwd(), "data", "images");
const OPENAI_QUALITY_MAP: Record<string, { model: string; quality: string; size: string }> = {
  standard: { model: "dall-e-3", quality: "standard", size: "1024x1024" },
  hd: { model: "dall-e-3", quality: "hd", size: "1024x1024" },
  v2: { model: "dall-e-2", quality: "standard", size: "1024x1024" },
};

const REPLICATE_MODELS: Record<string, string> = {
  "sdxl": "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  "sd3": "stability-ai/stable-diffusion-3.5:1d6e7c2f4f5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
  "flux": "black-forest-labs/flux-schnell:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "playground": "playgroundai/playground-v2.5-1024px:a45f82a1382bed5a7aeb3a6f845f1b5c581b6f1a3f7c7d8e9f0a1b2c3d4e5f6",
};

export async function generateImage(options: ImageGenOptions): Promise<string> {
  const provider = options.provider || "replicate";
  const width = options.width || 1024;
  const height = options.height || 1024;

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const outputFile = resolve(options.outputFile || join(OUTPUT_DIR, `img_${randomUUID().slice(0, 8)}.png`));

  switch (provider) {
    case "openai": {
      const key = env.OPENAI_API_KEY;
      if (!key) throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
      const cfg = options.model ? (OPENAI_QUALITY_MAP[options.model] || OPENAI_QUALITY_MAP.standard) : OPENAI_QUALITY_MAP.standard;
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          prompt: options.prompt,
          n: 1,
          size: cfg.size,
          quality: cfg.quality,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI image error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL in response");
      const imgRes = await fetch(imageUrl);
      writeFileSync(outputFile, Buffer.from(await imgRes.arrayBuffer()));
      break;
    }

    case "replicate": {
      const key = env.REPLICATE_API_KEY;
      if (!key) throw new Error("Replicate API key not configured. Set REPLICATE_API_KEY in .env");
      const model = options.model ? (REPLICATE_MODELS[options.model] || REPLICATE_MODELS.sdxl) : REPLICATE_MODELS.sdxl;
      const [owner, modelName] = model.split("/")[0], modelId = model.split(":")[0].split("/")[1];
      const version = model.split(":")[1];

      // Start prediction
      const pred = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Prefer": "wait" },
        body: JSON.stringify({
          version,
          input: { prompt: options.prompt, negative_prompt: options.negativePrompt || "", width, height, num_outputs: 1 },
        }),
      });
      if (!pred.ok) throw new Error(`Replicate error: ${pred.status}`);
      const predData = await pred.json();
      const imageUrl = predData.output?.[0] || predData.output;
      if (!imageUrl || typeof imageUrl !== "string") throw new Error("Replicate returned no output");
      const imgRes = await fetch(imageUrl);
      writeFileSync(outputFile, Buffer.from(await imgRes.arrayBuffer()));
      break;
    }

    case "sd": {
      // Local Stable Diffusion via API (Automatic1111 / StableSwarm)
      const sdUrl = env.SD_API_URL || "http://127.0.0.1:7860";
      const res = await fetch(`${sdUrl}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: options.prompt,
          negative_prompt: options.negativePrompt || "",
          width, height,
          steps: 20,
          cfg_scale: 7,
          sampler_name: "Euler a",
        }),
      });
      if (!res.ok) throw new Error(`SD API error: ${res.status}`);
      const data = await res.json();
      const base64 = data.images?.[0];
      if (!base64) throw new Error("SD returned no images");
      writeFileSync(outputFile, Buffer.from(base64, "base64"));
      break;
    }

    case "prodia": {
      const key = env.PRODIA_API_KEY;
      if (!key) throw new Error("Prodia API key not configured. Set PRODIA_API_KEY in .env");
      const res = await fetch("https://api.prodia.com/v1/sd/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: options.prompt, negative_prompt: options.negativePrompt || "", model: "sdXL_v10.safetensors", width, height, steps: 25 }),
      });
      if (!res.ok) throw new Error(`Prodia error: ${res.status}`);
      const data = await res.json();
      if (data.job) {
        // Poll for result
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const status = await fetch(`https://api.prodia.com/v1/job/${data.job}`, {
            headers: { Authorization: `Bearer ${key}` },
          });
          const statusData = await status.json();
          if (statusData.status === "succeeded" && statusData.imageUrl) {
            const imgRes = await fetch(statusData.imageUrl);
            writeFileSync(outputFile, Buffer.from(await imgRes.arrayBuffer()));
            return outputFile;
          }
        }
        throw new Error("Prodia generation timed out");
      }
      throw new Error("Prodia returned no job ID");
    }
  }

  if (!existsSync(outputFile)) throw new Error("Image generation failed — no output file");
  return outputFile;
}

export function listImageModels(): Record<string, string[]> {
  return {
    openai: ["standard", "hd", "v2"],
    replicate: Object.keys(REPLICATE_MODELS),
    sd: ["any"],
    prodia: ["any"],
  };
}
