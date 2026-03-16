"use client";

import { motion } from "framer-motion";
import { Brain, Database, Network, ShieldCheck } from "lucide-react";

import { usePipelineStore } from "@/store/usePipelineStore";

const PHASE_COLORS = [
  "border-blue-500/40 bg-blue-500/10 text-blue-400",
  "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  "border-purple-500/40 bg-purple-500/10 text-purple-400",
];

const PhaseIcon = ({ icon }: { icon: string }) => {
  if (icon === "brain") return <Brain className="h-3.5 w-3.5" />;
  if (icon === "network") return <Network className="h-3.5 w-3.5" />;
  if (icon === "database") return <Database className="h-3.5 w-3.5" />;
  return <ShieldCheck className="h-3.5 w-3.5" />;
};

export function ReasoningTimeline() {
  const { result } = usePipelineStore();
  if (!result) return null;

  const { reasoning_trail } = result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-[#1e2d3d] bg-[#0d1117] p-5"
    >
      <p className="mb-5 font-mono text-xs tracking-widest text-slate-500 uppercase">Reasoning Audit Trail</p>
      <div className="space-y-0">
        {reasoning_trail.map((step, index) => (
          <motion.div
            key={`${step.phase_name}-${index}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {index < reasoning_trail.length - 1 && <div className="absolute top-10 bottom-0 left-5 w-px bg-[#1e2d3d]" />}
            <div className="flex gap-4">
              <div
                className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${PHASE_COLORS[index % PHASE_COLORS.length]}`}
              >
                <PhaseIcon icon={step.icon} />
              </div>

              <div className="flex-1 pb-6">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-200">{step.phase_name}</span>
                  <span className="font-mono text-xs text-slate-600">Phase {step.phase}</span>
                </div>
                <p className="mb-3 text-xs text-slate-400">{step.summary}</p>

                {step.details.length > 0 && (
                  <div className="space-y-1">
                    {step.details.slice(0, 5).map((detail, detailIndex) => (
                      <div
                        key={`${detail.label}-${detailIndex}`}
                        className="flex items-center justify-between rounded-lg border border-[#162030] bg-[#060a0f] px-2.5 py-1.5 text-xs"
                      >
                        <span className="max-w-[60%] truncate font-mono text-slate-500">{detail.label}</span>
                        <span className="font-mono text-slate-300">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
