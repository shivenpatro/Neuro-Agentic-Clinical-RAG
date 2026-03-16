"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Info } from "lucide-react";

import { DiagnosisCard } from "@/components/DiagnosisCard";
import { DifferentialTable } from "@/components/DifferentialTable";
import { DrugPanel } from "@/components/DrugPanel";
import { EntityCard } from "@/components/EntityCard";
import { GraphPathViewer } from "@/components/GraphPathViewer";
import { GraphTopology } from "@/components/GraphTopology";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { InputPanel } from "@/components/InputPanel";
import { PipelineVisualizer } from "@/components/PipelineVisualizer";
import { ReasoningTimeline } from "@/components/ReasoningTimeline";
import { SettingsDialog } from "@/components/SettingsDialog";
import { usePipelineStore } from "@/store/usePipelineStore";

export default function HomePage() {
  const { stage, error, result } = usePipelineStore();
  const showResults = stage === "complete" && result;

  return (
    <div className="min-h-screen bg-[#060a0f]">
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <header className="sticky top-0 z-50 border-b border-[#1e2d3d] bg-[#060a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20">
              <Activity className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <span className="font-mono text-sm font-semibold tracking-tight text-slate-200">
              Neuro<span className="text-blue-400">Clinical</span>.RAG
            </span>
            <span className="hidden rounded border border-[#1e2d3d] px-2 py-0.5 font-mono text-xs text-slate-500 sm:block">
              v1.0 - Neurosymbolic
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs text-slate-500">
            <span className="hidden items-center gap-1.5 md:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Local LLM
            </span>
            <span className="hidden items-center gap-1.5 md:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              Knowledge Graph
            </span>
            <SettingsDialog />
            <HistoryDrawer />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-[0.25em] text-blue-400/70 uppercase">Explainability-First Clinical AI</p>
          <h1 className="mb-4 text-4xl leading-tight text-white md:text-5xl">
            Neuro-Agentic
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Clinical Reasoning</span>
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-400">
            Unstructured clinical text to structured diagnosis with a fully auditable neurosymbolic reasoning path. Every decision is traceable.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-2">
            <div className="rounded-2xl border border-[#1e2d3d] bg-[#0d1117] p-6">
              <InputPanel />
            </div>
            <AnimatePresence>{stage !== "idle" && <PipelineVisualizer />}</AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-red-500/20 bg-red-950/20 p-4 font-mono text-sm text-red-400"
                >
                  <p className="mb-1 font-bold">Pipeline Error</p>
                  <p className="text-xs text-red-400/70">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="xl:col-span-3">
            <AnimatePresence mode="wait">
              {showResults ? (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <DiagnosisCard />
                  <DifferentialTable />
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <EntityCard />
                    <GraphPathViewer />
                  </div>
                  <ReasoningTimeline />
                  <DrugPanel />
                  <GraphTopology />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#1e2d3d] text-slate-600"
                >
                  <Activity className="h-8 w-8 opacity-30" />
                  <p className="font-mono text-sm">Results will appear here after analysis</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mx-auto mt-12 flex max-w-2xl items-start gap-2 rounded-xl border border-[#1e2d3d] bg-[#0d1117]/40 p-4 text-xs text-slate-600"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong className="text-slate-500">Research Prototype Only.</strong> This system is not a substitute for professional medical advice.
            Always consult a qualified healthcare professional.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
