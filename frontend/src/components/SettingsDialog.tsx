"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Cloud, Cog, Server, Settings, X } from "lucide-react";
import { usePipelineStore } from "@/store/usePipelineStore";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const {
    llmProvider,
    setLlmProvider,
    apiKey,
    setApiKey,
    customBaseUrl,
    setCustomBaseUrl,
    customModelName,
    setCustomModelName,
  } = usePipelineStore();

  useEffect(() => {
    setMounted(true);
    const savedProvider = localStorage.getItem("rag_provider");
    const savedKey = localStorage.getItem("rag_api_key");
    const savedUrl = localStorage.getItem("rag_base_url");
    const savedModel = localStorage.getItem("rag_model");

    if (savedProvider) setLlmProvider(savedProvider as any);
    if (savedKey) setApiKey(savedKey);
    if (savedUrl) setCustomBaseUrl(savedUrl);
    if (savedModel) setCustomModelName(savedModel);
  }, [setLlmProvider, setApiKey, setCustomBaseUrl, setCustomModelName]);

  useEffect(() => {
    localStorage.setItem("rag_provider", llmProvider);
    localStorage.setItem("rag_api_key", apiKey);
    localStorage.setItem("rag_base_url", customBaseUrl);
    localStorage.setItem("rag_model", customModelName);
  }, [llmProvider, apiKey, customBaseUrl, customModelName]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                >
                  <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-[#0d1117] border border-[#1e2d3d] rounded-2xl shadow-2xl pointer-events-auto">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d3d] shrink-0">
                      <div className="flex items-center gap-2">
                        <Cog className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-sm font-semibold text-slate-200">
                          LLM Configuration
                        </span>
                      </div>
                      <button
                        onClick={() => setOpen(false)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 space-y-6 overflow-y-auto">
                      {/* Provider Selection */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "ollama", label: "Local (Ollama)", icon: Server },
                          { id: "groq", label: "Cloud (Groq)", icon: Cloud },
                          {
                            id: "custom",
                            label: "Custom / OpenAI",
                            icon: Settings,
                          },
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setLlmProvider(p.id as any)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                              llmProvider === p.id
                                ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                                : "bg-[#060a0f] border-[#1e2d3d] text-slate-500 hover:border-[#304050]"
                            }`}
                          >
                            <p.icon className="w-5 h-5" />
                            <span className="text-xs font-mono font-medium">
                              {p.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4">
                        {llmProvider === "ollama" && (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
                            Using local Ollama instance at http://localhost:11434.
                            No API key required.
                          </div>
                        )}

                        {llmProvider === "groq" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-xs font-mono text-slate-400">
                                Groq API Key
                              </label>
                              <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="gsk_..."
                                className="w-full bg-[#060a0f] border border-[#1e2d3d] rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500/40"
                              />
                              <p className="text-[10px] text-slate-600">
                                Get a free key at{" "}
                                <a
                                  href="https://console.groq.com/keys"
                                  target="_blank"
                                  className="text-blue-400 hover:underline"
                                >
                                  console.groq.com
                                </a>
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-mono">
                              Default model: llama3-70b-8192 (Fast & Free)
                            </div>
                          </>
                        )}

                        {llmProvider === "custom" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-xs font-mono text-slate-400">
                                Base URL
                              </label>
                              <input
                                value={customBaseUrl}
                                onChange={(e) => setCustomBaseUrl(e.target.value)}
                                placeholder="https://api.openai.com/v1"
                                className="w-full bg-[#060a0f] border border-[#1e2d3d] rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-mono text-slate-400">
                                API Key
                              </label>
                              <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-[#060a0f] border border-[#1e2d3d] rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-mono text-slate-400">
                                Model Name
                              </label>
                              <input
                                value={customModelName}
                                onChange={(e) =>
                                  setCustomModelName(e.target.value)
                                }
                                placeholder="gpt-4o"
                                className="w-full bg-[#060a0f] border border-[#1e2d3d] rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-4 border-t border-[#1e2d3d] bg-[#060a0f]/50 flex justify-end shrink-0">
                      <button
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 rounded-lg bg-blue-500 text-white text-xs font-mono font-medium hover:bg-blue-600 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
