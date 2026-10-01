import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadsDir, MAX_IMAGE_BYTES, saveImageBase64ToDisk } from './diskStore';
import { safeImageUrl } from './contentSecurity';

let ai: GoogleGenAI | undefined;
function getAI() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') return undefined;
  return ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 240000 } });
}
export function imageProviderModel() {
  return process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image-preview' : 'gemini-3.1-flash-lite-image';
}
function referenceForProvider(url: string) {
  if (!url.startsWith('/uploads/')) return url;
  const filename = url.slice('/uploads/'.length);
  const mime = filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' : filename.endsWith('.webp') ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(path.join(getUploadsDir(), filename)).toString('base64')}`;
}
async function persistImage(url: string, ownerUserId: string) {
  const match = url.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (match) return saveImageBase64ToDisk(match[2], match[1], ownerUserId);
  safeImageUrl(url);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new Error('Image unavailable.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image unavailable.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) throw new Error('Image exceeds limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return saveImageBase64ToDisk(Buffer.concat(chunks).toString('base64'), (response.headers.get('content-type') || '').split(';')[0], ownerUserId);
}
export interface ImageRequest { prompt: string; aspectRatio: string; resolution?: string; referenceImageUrl?: string }
export async function generateImage(params: ImageRequest, ownerUserId: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (apiKey) {
    const content: any[] = [{ type: 'text', text: `${params.prompt}\nCreate one image. Aspect ratio: ${params.aspectRatio}; resolution: ${params.resolution || '1K'}.` }];
    if (params.referenceImageUrl) content.push({ type: 'image_url', image_url: { url: referenceForProvider(params.referenceImageUrl) } });
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: imageProviderModel(), messages: [{ role: 'user', content }], modalities: ['image', 'text'] }),
      signal: AbortSignal.timeout(240000),
    });
    if (!response.ok) throw new Error('Provider request failed.');
    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    const images = [...(Array.isArray(message?.images) ? message.images : []), ...(Array.isArray(message?.content) ? message.content : [])];
    for (const item of images) {
      const url = item?.image_url?.url || item?.imageUrl?.url || item?.url;
      if (typeof url === 'string') return persistImage(url, ownerUserId);
    }
    throw new Error('Provider returned no image.');
  }
  const client = getAI();
  if (client) {
    const parts: any[] = [{ text: params.prompt }];
    if (params.referenceImageUrl) {
      const reference = referenceForProvider(params.referenceImageUrl);
      const match = reference.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    const response = await client.models.generateContent({ model: imageProviderModel(), contents: { parts }, config: { imageConfig: { aspectRatio: params.aspectRatio } } });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return saveImageBase64ToDisk(part.inlineData.data, part.inlineData.mimeType, ownerUserId);
    }
    throw new Error('Provider returned no image.');
  }
  throw new Error('No image provider configured.');
}
export async function optimizePrompt(basePrompt: string, category: string, model: string): Promise<string> {
  const client = getAI();
  if (!client) throw new Error('No prompt provider configured.');
  const response = await client.models.generateContent({ model: 'gemini-3.7-flash', contents:
    `Optimize this product photography prompt for ${model}. Preserve variable placeholders. Return only the prompt. Category: ${category}. Prompt: ${basePrompt}` });
  return response.text?.trim() || basePrompt;
}
