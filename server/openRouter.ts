const API_URL = 'https://openrouter.ai/api/v1';
const CATALOG_CACHE_MS = 60 * 60 * 1000;

interface OpenRouterModel {
  id: string;
  created: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

let catalog: { models: OpenRouterModel[]; expiresAt: number } | undefined;
let catalogRequest: Promise<OpenRouterModel[]> | undefined;

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

async function requestOpenRouter(endpoint: string, body?: unknown, timeoutMs = 15000): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for AI requests.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
        ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data?.error) {
      throw new Error(data?.error?.message || data?.message || `OpenRouter request failed with HTTP ${response.status}.`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getModelCatalog(): Promise<OpenRouterModel[]> {
  if (catalog && catalog.expiresAt > Date.now()) return catalog.models;
  if (!catalogRequest) {
    catalogRequest = requestOpenRouter('models').then((data) => {
      if (!Array.isArray(data?.data)) throw new Error('OpenRouter returned an invalid model catalog.');
      catalog = { models: data.data, expiresAt: Date.now() + CATALOG_CACHE_MS };
      return catalog.models;
    }).finally(() => {
      catalogRequest = undefined;
    });
  }
  return catalogRequest;
}

export async function resolveOpenRouterModel(kind: 'image' | 'text', needsReferenceImage = false): Promise<string> {
  const configured = (kind === 'image' ? process.env.OPENROUTER_IMAGE_MODEL : process.env.OPENROUTER_TEXT_MODEL)?.trim();
  if (configured && configured !== 'latest') return configured;

  const models = await getModelCatalog();
  const compatible = models.filter((model) => {
    const inputs = model.architecture?.input_modalities || [];
    const outputs = model.architecture?.output_modalities || [];
    return typeof model.id === 'string' && Number.isFinite(model.created)
      && !model.id.startsWith('openrouter/')
      && inputs.includes('text') && outputs.includes(kind)
      && (kind !== 'text' || !outputs.includes('image'))
      && (!needsReferenceImage || inputs.includes('image'));
  }).sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));

  if (!compatible.length) throw new Error(`OpenRouter has no compatible ${kind} model available.`);
  return compatible[0].id;
}

export function completeWithOpenRouter(body: unknown, timeoutMs = 240000): Promise<any> {
  return requestOpenRouter('chat/completions', body, timeoutMs);
}
