"use client";

import { motion } from "framer-motion";
import { CheckCircle2, GitBranch, MinusCircle, XCircle } from "lucide-react";

import { usePipelineStore } from "@/store/usePipelineStore";

const VerdictIcon = ({ verdict }: { verdict: string }) => {
  if (verdict === "EXCLUDED" || verdict === "DISQUALIFIED") return <XCircle className="h-3 w-3 text-red-400" />;
  if (verdict === "PASSES" || verdict === "matched") return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
  return <MinusCircle className="h-3 w-3 text-slate-500" />;
};

export function GraphPathViewer() {
  const { result } = usePipelineStore();
  if (!result) return null;

  const { graph_path, graph_coverage, candidates } = result.graph_result;
  const displayed = graph_path.slice(0, 12);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-[#1e2d3d] bg-[#0d1117] p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-cyan-400" />
        <h3 className="font-mono text-xs font-semibold tracking-widest text-slate-300 uppercase">Graph Traversal Path</h3>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { label: "Matched", value: graph_coverage.symptoms_in_graph, color: "text-emerald-400" },
          { label: "Unmatched", value: graph_coverage.symptoms_not_found, color: "text-amber-400" },
          { label: "Evaluated", value: graph_coverage.diseases_evaluated, color: "text-blue-400" },
          { label: "Accepted", value: graph_coverage.diseases_accepted, color: "text-cyan-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-[#162030] bg-[#060a0f] p-2 text-center">
            <p className={`font-mono text-base font-bold ${color}`}>{value}</p>
            <p className="mt-0.5 text-xs text-slate-600">{label}</p>
          </div>
        ))}
      </div>

      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {displayed.map((step, index) => {
          const line = step as Record<string, string>;
          const label = line.disease || line.input || `Step ${index + 1}`;
          const verdict = line.verdict || line.status || "";
          return (
            <motion.div
              key={`${label}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-2 rounded-lg border border-[#162030] bg-[#060a0f] px-3 py-1.5"
            >
              <VerdictIcon verdict={verdict} />
              <span className="flex-1 truncate font-mono text-xs text-slate-400">{label}</span>
              <span
                className={`font-mono text-xs font-semibold ${
                  verdict.includes("EXCLUDED") || verdict.includes("DISQUALIFIED")
                    ? "text-red-400"
                    : verdict.includes("PASSES") || verdict.includes("matched")
                      ? "text-emerald-400"
                      : "text-slate-500"
                }`}
              >
                {verdict}
              </span>
            </motion.div>
          );
        })}
      </div>

      {candidates.filter((candidate) => candidate.status !== "valid").length > 0 && (
        <div className="mt-3 border-t border-[#162030] pt-3">
          <p className="mb-2 font-mono text-xs text-slate-600">Rejected candidates:</p>
          <div className="flex flex-wrap gap-1.5">
            {candidates
              .filter((candidate) => candidate.status !== "valid")
              .map((candidate) => (
                <span
                  key={candidate.disease_id}
                  className="rounded border border-red-500/10 bg-red-950/20 px-2 py-0.5 font-mono text-xs text-red-400/70 line-through"
                >
                  {candidate.disease_name}
                </span>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
