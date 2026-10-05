import fs from 'node:fs';
import path from 'node:path';
import { getUploadsDir, MAX_IMAGE_BYTES, saveImageBase64ToDisk } from './diskStore';
import { safeImageUrl } from './contentSecurity';
import { completeWithOpenRouter, resolveOpenRouterModel } from './openRouter';

export function imageProviderModel(needsReferenceImage = false) {
  return resolveOpenRouterModel('image', needsReferenceImage);
}
export function promptProviderModel() {
  return resolveOpenRouterModel('text');
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
export interface ImageRequest { prompt: string; aspectRatio: string; resolution?: string; referenceImageUrl?: string; selectedModel?: string }
export async function generateImage(params: ImageRequest, ownerUserId: string): Promise<string> {
  const selectedModel = params.selectedModel || await imageProviderModel(Boolean(params.referenceImageUrl));
  const content: any[] = [{ type: 'text', text: `${params.prompt}\nCreate one image. Aspect ratio: ${params.aspectRatio}; resolution: ${params.resolution || '1K'}.` }];
  if (params.referenceImageUrl) content.push({ type: 'image_url', image_url: { url: referenceForProvider(params.referenceImageUrl) } });
  const data = await completeWithOpenRouter({
    model: selectedModel, messages: [{ role: 'user', content }], modalities: ['image'],
  });
  const message = data?.choices?.[0]?.message;
  const images = [...(Array.isArray(message?.images) ? message.images : []), ...(Array.isArray(message?.content) ? message.content : [])];
  for (const item of images) {
    const url = item?.image_url?.url || item?.imageUrl?.url || item?.url;
    if (typeof url === 'string') return persistImage(url, ownerUserId);
  }
  throw new Error('Provider returned no image.');
}
export async function optimizePrompt(basePrompt: string, category: string, model: string, selectedModel?: string): Promise<string> {
  const response = await completeWithOpenRouter({
    model: selectedModel || await promptProviderModel(),
    messages: [{ role: 'user', content:
      `Optimize this product photography prompt for ${model}. Preserve all variable placeholders exactly, including {{OBJECT}} and {{TEXT_ZONE}}. Return only the prompt. Category: ${category}. Prompt: ${basePrompt}` }],
  });
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Provider returned no optimized prompt.');
  return content.trim();
}
