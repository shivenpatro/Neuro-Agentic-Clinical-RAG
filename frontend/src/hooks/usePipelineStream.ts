"use client";
import { useCallback } from "react";
import { usePipelineStore } from "@/store/usePipelineStore";
import type { PipelineStage } from "@/types/pipeline";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Parse raw SSE stream text from /api/analyze/stream.
 * Handles partial chunks by buffering lines between yields.
 */
async function* readSSE(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no readable body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        try {
          yield JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  }
}

export function usePipelineStream() {
  const {
    clinicalText,
    setStage,
    setResult,
    setError,
    setIsLoading,
    setPartialExtraction,
    setPartialGraphResult,
    setPartialVerification,
    llmProvider,
    apiKey,
    customBaseUrl,
    customModelName,
  } = usePipelineStore();

  const runPipeline = useCallback(async () => {
    if (!clinicalText.trim()) return;

    // Build config object if needed
    let llmConfig = undefined;
    if (llmProvider === "groq") {
      if (!apiKey) {
        setError("Groq API Key is required. Please set it in Settings.");
        return;
      }
      llmConfig = { provider: "groq", api_key: apiKey };
    } else if (llmProvider === "custom") {
      if (!customBaseUrl || !apiKey || !customModelName) {
        setError("Base URL, API Key, and Model Name are required for custom provider.");
        return;
      }
      llmConfig = { provider: "custom", base_url: customBaseUrl, api_key: apiKey, model_name: customModelName };
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setPartialExtraction(null);
    setPartialGraphResult(null);
    setPartialVerification(null);
    setStage("extracting");

    try {
      const response = await fetch(`${API_BASE}/api/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clinicalText, llm_config: llmConfig }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      for await (const event of readSSE(response)) {
        const eventType = event.event as string;

        switch (eventType) {
          case "stage":
            setStage(event.stage as PipelineStage);
            break;
          case "extraction_done":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setPartialExtraction(event.data as any);
            break;
          case "graph_done":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setPartialGraphResult(event.data as any);
            break;
          case "verification_done":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setPartialVerification(event.data as any);
            break;
          case "complete":
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setResult(event.data as any);
            setStage("complete");
            break;
          case "error":
            throw new Error(event.message as string);
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Ensure Ollama is running and the backend is active.";
      setError(message);
      setStage("error");
    } finally {
      setIsLoading(false);
    }
  }, [
    clinicalText,
    setError,
    setIsLoading,
    setResult,
    setStage,
    setPartialExtraction,
    setPartialGraphResult,
    setPartialVerification,
    llmProvider,
    apiKey,
    customBaseUrl,
    customModelName,
  ]);

  return { runPipeline };
}
