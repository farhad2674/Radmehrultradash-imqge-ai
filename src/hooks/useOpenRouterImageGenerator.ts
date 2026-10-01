import { apiFetch } from '../services/authService';
import { useState, useRef, useCallback, useEffect } from 'react';
import { GenerateParams, UseOpenRouterImageGeneratorResult } from '../types';

const MAX_GENERATION_WAIT_MS = 4 * 60 * 1000;
const INITIAL_POLL_DELAY_MS = 1500;
const POLL_INTERVAL_MS = 3500;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getRemainingWaitMs(startedAt: number): number {
  return Math.max(MAX_GENERATION_WAIT_MS - (Date.now() - startedAt), 0);
}

export function useOpenRouterImageGenerator(): UseOpenRouterImageGeneratorResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cancelPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPolling();
    };
  }, [cancelPolling]);

  const generateImage = useCallback(
    async (params: GenerateParams): Promise<string | null> => {
      cancelPolling();
      setLoading(true);
      setError(null);
      setStatus('INITIATING');
      setTaskId(null);
      setElapsedSeconds(0);

      // Start elapsed timer
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      const generationStartedAt = Date.now();

      try {
        // Step 1: Request task creation
        const initRes = await fetchWithTimeout('/api/openrouter/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }, getRemainingWaitMs(generationStartedAt));

        const initData = await initRes.json();

        if (!initRes.ok || !initData.taskId) {
          throw new Error(initData.error || 'Failed to initiate generation task.');
        }

        const currentTaskId = initData.taskId;
        setTaskId(currentTaskId);
        setStatus('PROCESSING');

        // Step 2: Poll until the provider returns a terminal state (COMPLETED/SUCCESS or FAILED),
        // unless the full generation wait exceeds 4 minutes.
        return new Promise<string | null>((resolve, reject) => {
          const checkStatus = async () => {
            try {
              const remainingWaitMs = getRemainingWaitMs(generationStartedAt);
              if (remainingWaitMs <= 0) {
                throw new Error('Image generation timed out after 4 minutes. Please try again.');
              }

              const statusRes = await fetchWithTimeout(`/api/openrouter/status?taskId=${currentTaskId}`, {}, remainingWaitMs);
              const statusData = await statusRes.json();

              if (!statusRes.ok) {
                throw new Error(statusData.error || 'Error checking task status.');
              }

              const currentStatus = statusData.status?.toUpperCase();
              setStatus(currentStatus);

              if (currentStatus === 'COMPLETED' || currentStatus === 'SUCCESS') {
                cancelPolling();
                setLoading(false);
                if (statusData.imageUrl) {
                  resolve(statusData.imageUrl);
                } else {
                  const err = 'Task completed but no image URL was returned.';
                  setError(err);
                  reject(new Error(err));
                }
              } else if (currentStatus === 'FAILED') {
                cancelPolling();
                setLoading(false);
                const err = statusData.error || 'Image generation failed on server.';
                setError(err);
                reject(new Error(err));
              } else {
                scheduleNextStatusCheck();
              }
            } catch (err: any) {
              cancelPolling();
              setLoading(false);
              setError(err.message || 'Polling network failure.');
              reject(err);
            }
          };

          const scheduleNextStatusCheck = () => {
            const remainingWaitMs = getRemainingWaitMs(generationStartedAt);
            if (remainingWaitMs <= 0) {
              checkStatus();
              return;
            }
            pollTimerRef.current = setTimeout(checkStatus, Math.min(POLL_INTERVAL_MS, remainingWaitMs));
          };

          const initialDelay = Math.min(INITIAL_POLL_DELAY_MS, getRemainingWaitMs(generationStartedAt));
          pollTimerRef.current = setTimeout(checkStatus, initialDelay);
        });
      } catch (err: any) {
        cancelPolling();
        setLoading(false);
        setStatus('FAILED');
        const errMsg = err.message || 'An unexpected error occurred.';
        setError(errMsg);
        return null;
      }
    },
    [cancelPolling]
  );

  return {
    generateImage,
    loading,
    status,
    error,
    cancelPolling,
    taskId,
    elapsedSeconds,
  };
}
