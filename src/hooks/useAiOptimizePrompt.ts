import { useEffect, useRef, useState } from "react";

import { aiOptimizePrompt, type AiOptimizePromptInput } from "@/lib/codex";

export function useAiOptimizePrompt(open: boolean) {
  const requestIdRef = useRef(0);
  const [optimizedPrompt, setOptimizedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    requestIdRef.current += 1;
    setOptimizedPrompt(null);
    setError(null);
    setLoading(false);
  };

  const showError = (message: string) => {
    requestIdRef.current += 1;
    setOptimizedPrompt(null);
    setError(message);
    setLoading(false);
  };

  const generate = async (input: AiOptimizePromptInput) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setOptimizedPrompt(null);
    setError(null);
    setLoading(true);

    try {
      const result = (await aiOptimizePrompt(input)).trim();
      if (!result) {
        throw new Error("AI 未返回可展示的优化提示词。");
      }

      if (requestIdRef.current !== requestId) {
        return null;
      }

      setOptimizedPrompt(result);
      return result;
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return null;
      }

      setError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  return {
    optimizedPrompt,
    loading,
    error,
    reset,
    showError,
    generate,
  };
}
