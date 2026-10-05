// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const models = [
  { id: 'provider/old-image', created: 10, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text', 'image'] } },
  { id: 'provider/new-image', created: 30, architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] } },
  { id: 'provider/newest-text-to-image', created: 40, architecture: { input_modalities: ['text'], output_modalities: ['image'] } },
  { id: 'provider/old-chat', created: 15, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
  { id: 'provider/new-chat', created: 25, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
  { id: 'provider/embedding', created: 50, architecture: { input_modalities: ['text'], output_modalities: ['embeddings'] } },
  { id: 'openrouter/auto', created: 60, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
];

describe('OpenRouter provider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'latest');
    vi.stubEnv('OPENROUTER_TEXT_MODEL', 'latest');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: models })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('selects the newest compatible models and reuses one catalog across features', async () => {
    const { resolveOpenRouterModel } = await import('./openRouter');
    expect(await resolveOpenRouterModel('image')).toBe('provider/newest-text-to-image');
    expect(await resolveOpenRouterModel('image', true)).toBe('provider/new-image');
    expect(await resolveOpenRouterModel('text')).toBe('provider/new-chat');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', expect.objectContaining({ method: 'GET' }));
  });

  it('honors explicit model overrides without fetching the catalog', async () => {
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', ' provider/pinned-image ');
    vi.stubEnv('OPENROUTER_TEXT_MODEL', 'provider/pinned-chat');
    const { resolveOpenRouterModel } = await import('./openRouter');
    expect(await resolveOpenRouterModel('image')).toBe('provider/pinned-image');
    expect(await resolveOpenRouterModel('text')).toBe('provider/pinned-chat');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses catalog discovery when model settings are blank', async () => {
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', '');
    vi.stubEnv('OPENROUTER_TEXT_MODEL', '');
    const { resolveOpenRouterModel } = await import('./openRouter');
    expect(await resolveOpenRouterModel('image')).toBe('provider/newest-text-to-image');
    expect(await resolveOpenRouterModel('text')).toBe('provider/new-chat');
  });

  it('refreshes the catalog after an hour to pick up new releases', async () => {
    vi.useFakeTimers();
    const { resolveOpenRouterModel } = await import('./openRouter');
    expect(await resolveOpenRouterModel('image')).toBe('provider/newest-text-to-image');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [
      ...models, { ...models[1], id: 'provider/just-released', created: 100 },
    ] }));
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1);
    expect(await resolveOpenRouterModel('image')).toBe('provider/just-released');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects an incompatible catalog rather than sending an image request to a text model', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: models.filter((model) => !model.architecture.output_modalities.includes('image')) }));
    const { resolveOpenRouterModel } = await import('./openRouter');
    await expect(resolveOpenRouterModel('image')).rejects.toThrow('no compatible image model');
  });

  it('retries discovery after a catalog request fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { message: 'Temporarily unavailable' } }, 503));
    const { resolveOpenRouterModel } = await import('./openRouter');
    await expect(resolveOpenRouterModel('image')).rejects.toThrow('Temporarily unavailable');
    expect(await resolveOpenRouterModel('image')).toBe('provider/newest-text-to-image');
  });

  it('requires only an OpenRouter key and never calls a different provider', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', ' ');
    vi.stubEnv('GEMINI_API_KEY', 'unused-test-key');
    const { completeWithOpenRouter, hasOpenRouterKey } = await import('./openRouter');
    expect(hasOpenRouterKey()).toBe(false);
    await expect(completeWithOpenRouter({})).rejects.toThrow('OPENROUTER_API_KEY is required');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends completion requests and metadata to OpenRouter using the single key', async () => {
    vi.stubEnv('APP_URL', 'https://studio.example.com');
    vi.stubEnv('OPENROUTER_APP_NAME', 'Radmehr AI Studio');
    const response = { choices: [{ message: { content: 'Polished {{OBJECT}} prompt' } }] };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(response));
    const { completeWithOpenRouter } = await import('./openRouter');
    const body = { model: 'provider/new-chat', messages: [{ role: 'user', content: '{{OBJECT}}' }] };
    expect(await completeWithOpenRouter(body)).toEqual(response);
    expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/chat/completions', expect.objectContaining({
      method: 'POST', body: JSON.stringify(body),
      headers: expect.objectContaining({
        Authorization: 'Bearer test-openrouter-key',
        'HTTP-Referer': 'https://studio.example.com',
        'X-Title': 'Radmehr AI Studio',
      }),
    }));
  });

  it('reports provider failures without treating them as successful completions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { message: 'Insufficient credits' } }, 402));
    const { completeWithOpenRouter } = await import('./openRouter');
    await expect(completeWithOpenRouter({})).rejects.toThrow('Insufficient credits');
  });

  it('aborts slow provider requests', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Request aborted', 'AbortError')));
    }));
    const { completeWithOpenRouter } = await import('./openRouter');
    const request = completeWithOpenRouter({}, 1000);
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
