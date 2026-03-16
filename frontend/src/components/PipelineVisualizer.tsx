"use client";

import { motion } from "framer-motion";
import { Brain, ChevronRight, Network, ShieldCheck } from "lucide-react";

import { usePipelineStore } from "@/store/usePipelineStore";
import type { PipelineStage } from "@/types/pipeline";

const STAGES = [
  { id: "extracting", order: 1, label: "Neural Extraction", sublabel: "LLM parses clinical text", icon: Brain, color: "blue" },
  { id: "graph_querying", order: 2, label: "Symbolic Verification", sublabel: "Knowledge graph traversal", icon: Network, color: "cyan" },
  { id: "verifying", order: 3, label: "Agentic Synthesis", sublabel: "Hallucination rejection + verdict", icon: ShieldCheck, color: "emerald" },
] as const;

const STAGE_ORDER: Record<PipelineStage, number> = {
  idle: 0,
  extracting: 1,
  graph_querying: 2,
  verifying: 3,
  complete: 4,
  error: -1,
};

function StageNode({ stage, currentStage }: { stage: (typeof STAGES)[number]; currentStage: PipelineStage }) {
  const current = STAGE_ORDER[currentStage];
  const isActive = current === stage.order;
  const isDone = current > stage.order;
  const Icon = stage.icon;

  const colorMap = {
    blue: { active: "border-blue-500 bg-blue-500/10 text-blue-400", done: "border-blue-500/40 bg-blue-500/5 text-blue-400/60", idle: "border-[#1e2d3d] text-slate-600" },
    cyan: { active: "border-cyan-500 bg-cyan-500/10 text-cyan-400", done: "border-cyan-500/40 bg-cyan-500/5 text-cyan-400/60", idle: "border-[#1e2d3d] text-slate-600" },
    emerald: { active: "border-emerald-500 bg-emerald-500/10 text-emerald-400", done: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400/60", idle: "border-[#1e2d3d] text-slate-600" },
  };

  const colors = colorMap[stage.color];
  const state = isActive ? "active" : isDone ? "done" : "idle";

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <motion.div
        animate={isActive ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 1.5 } } : {}}
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${colors[state]}`}
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <div className="text-center">
        <p className={`font-mono text-xs font-semibold tracking-wide transition-colors duration-300 ${isActive ? "text-slate-100" : isDone ? "text-slate-400" : "text-slate-600"}`}>
          {stage.label}
        </p>
        <p className="mt-0.5 text-xs leading-tight text-slate-600">{stage.sublabel}</p>
      </div>
    </div>
  );
}

export function PipelineVisualizer() {
  const { stage } = usePipelineStore();
  if (stage === "idle") return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border border-[#1e2d3d] bg-[#0d1117] p-6">
      <p className="mb-6 font-mono text-xs tracking-widest text-slate-500 uppercase">Pipeline Progress</p>
      <div className="flex items-center">
        {STAGES.map((item, index) => (
          <div key={item.id} className="flex flex-1 items-center">
            <StageNode stage={item} currentStage={stage} />
            {index < STAGES.length - 1 && (
              <ChevronRight className={`mx-1 h-4 w-4 shrink-0 transition-colors duration-500 ${STAGE_ORDER[stage] > item.order ? "text-slate-500" : "text-slate-700"}`} />
            )}
          </div>
        ))}
      </div>
      {stage === "complete" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 border-t border-[#1e2d3d] pt-4 font-mono text-xs text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Analysis complete - all stages verified
        </motion.div>
      )}
    </motion.div>
  );
}
