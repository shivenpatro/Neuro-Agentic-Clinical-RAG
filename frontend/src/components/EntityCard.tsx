"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Tag } from "lucide-react";

import { usePipelineStore } from "@/store/usePipelineStore";

export function EntityCard() {
  const { result } = usePipelineStore();
  if (!result) return null;

  const { symptoms } = result.extraction;
  const { matched_symptoms, unknown_symptoms } = result.graph_result;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-[#1e2d3d] bg-[#0d1117] p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <Tag className="h-3.5 w-3.5 text-blue-400" />
        <h3 className="font-mono text-xs font-semibold tracking-widest text-slate-300 uppercase">Extracted Entities</h3>
        <span className="ml-auto font-mono text-xs text-slate-600">{symptoms.length} found</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {symptoms.map((symptom, index) => {
          const isMatched = matched_symptoms.some((item) =>
            item.replace(/_/g, " ").toLowerCase().includes(symptom.raw_text.toLowerCase().substring(0, 8)),
          );
          return (
            <motion.div
              key={`${symptom.raw_text}-${index}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs ${isMatched ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: isMatched ? "#3b82f6" : "#f59e0b" }} />
              {symptom.raw_text}
              <span className="text-xs opacity-50">{Math.round(symptom.confidence * 100)}%</span>
            </motion.div>
          );
        })}
      </div>

      {unknown_symptoms.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/10 bg-amber-950/20 p-3 text-xs text-amber-400/70">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            <strong>{unknown_symptoms.length}</strong> symptom(s) not found in knowledge graph: {unknown_symptoms.join(", ")}
          </span>
        </div>
      )}
    </motion.div>
  );
}
