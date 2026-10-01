import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOpenRouterImageGenerator } from './useOpenRouterImageGenerator';

function jsonResponse(data: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(data) } as unknown as Response;
}

const params = {
  prompt: 'A smart refrigerator',
  model: 'nano-banana-2' as const,
  aspectRatio: '16:9',
};

describe('useOpenRouterImageGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a task, polls through processing, and returns the completed image', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ taskId: 'job-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'PROCESSING' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'COMPLETED', imageUrl: '/uploads/result.png' }));
    const { result } = renderHook(() => useOpenRouterImageGenerator());

    let generation!: Promise<string | null>;
    act(() => {
      generation = result.current.generateImage(params);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
      await vi.advanceTimersByTimeAsync(3_500);
    });

    await expect(generation).resolves.toBe('/uploads/result.png');
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/openrouter/generate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(params),
    }));
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/openrouter/status?taskId=job-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.status).toBe('COMPLETED');
  });

  it('returns null and exposes an initiation error', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Prompt is required' }, false));
    const { result } = renderHook(() => useOpenRouterImageGenerator());

    let value: string | null = 'pending';
    await act(async () => {
      value = await result.current.generateImage(params);
    });

    expect(value).toBeNull();
    expect(result.current.status).toBe('FAILED');
    expect(result.current.error).toBe('Prompt is required');
  });

  it('rejects with the server error when polling reports failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ taskId: 'job-2' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'FAILED', error: 'Provider rejected request' }));
    const { result } = renderHook(() => useOpenRouterImageGenerator());

    let generation!: Promise<string | null>;
    act(() => {
      generation = result.current.generateImage(params);
    });
    const rejection = expect(generation).rejects.toThrow('Provider rejected request');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    await rejection;
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Provider rejected request');
  });

  it('rejects when completion has no image URL', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ taskId: 'job-3' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'COMPLETED' }));
    const { result } = renderHook(() => useOpenRouterImageGenerator());

    let generation!: Promise<string | null>;
    act(() => {
      generation = result.current.generateImage(params);
    });
    const rejection = expect(generation).rejects.toThrow('Task completed but no image URL was returned.');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    await rejection;
  });

  it('clears active timers when unmounted', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ taskId: 'job-4' }));
    const { result, unmount } = renderHook(() => useOpenRouterImageGenerator());

    act(() => {
      void result.current.generateImage(params);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
