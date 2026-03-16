"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, TableProperties } from "lucide-react";
import { usePipelineStore } from "@/store/usePipelineStore";
import { urgencyToColor, urgencyToLabel } from "@/lib/utils";
import type { DiagnosisCandidate } from "@/types/pipeline";

function statusColor(status: string) {
  switch (status) {
    case "valid": return "text-emerald-400 bg-emerald-950/30 border-emerald-500/20";
    case "excluded": return "text-red-400 bg-red-950/30 border-red-500/20";
    case "missing_required": return "text-amber-400 bg-amber-950/30 border-amber-500/20";
    case "below_threshold": return "text-orange-400 bg-orange-950/30 border-orange-500/20";
    default: return "text-slate-400 bg-slate-950/30 border-slate-500/20";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "valid": return "Confirmed";
    case "excluded": return "Excluded";
    case "missing_required": return "Missing Req.";
    case "below_threshold": return "Low Score";
    default: return status;
  }
}

function getRejectionReason(candidate: DiagnosisCandidate): string {
  if (candidate.status === "excluded") {
    const r = candidate.reasoning.find((r) => r.rule === "EXCLUSION");
    return r ? r.message : "Hard exclusion rule triggered";
  }
  if (candidate.status === "missing_required") {
    const missing = candidate.reasoning
      .filter((r) => r.rule === "REQUIRED_MISSING")
      .map((r) => r.symptom?.replace(/_/g, " "))
      .join(", ");
    return missing ? `Missing required: ${missing}` : "Required symptom absent";
  }
  if (candidate.status === "below_threshold") {
    return `Score ${candidate.score.toFixed(2)} below threshold ${(candidate.threshold ?? 0).toFixed(2)}`;
  }
  return "";
}

function ExpandedRow({ candidate }: { candidate: DiagnosisCandidate }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <td colSpan={7} className="px-4 pb-3 pt-0">
        <div className="bg-[#060a0f] rounded-lg border border-[#162030] p-3">
          {candidate.matched_symptoms.length > 0 ? (
            <div>
              <p className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">Matched Symptoms</p>
              <div className="flex flex-wrap gap-2">
                {candidate.matched_symptoms.map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono bg-blue-950/30 border border-blue-500/20 rounded-lg text-blue-300">
                    <span>{s.symptom?.replace(/_/g, " ")}</span>
                    <span className="text-blue-500">w:{s.weight?.toFixed(2)}</span>
                    {s.required && <span className="text-purple-400 text-xs">REQ</span>}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 font-mono">No symptoms matched for this candidate.</p>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

export function DifferentialTable() {
  const { result } = usePipelineStore();
  const [expanded, setExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (!result) return null;

  const candidates = [...result.graph_result.candidates].sort((a, b) => b.score - a.score);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-[#0d1117] border border-[#1e2d3d] rounded-2xl overflow-hidden"
    >
      {/* Header toggle */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#131b24] transition-colors"
      >
        <div className="flex items-center gap-2">
          <TableProperties className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-widest">
            Differential Diagnosis
          </span>
          <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-[#060a0f] border border-[#1e2d3d] text-slate-500">
            {candidates.length} candidates
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-t border-[#1e2d3d] bg-[#060a0f]">
                    <th className="px-4 py-2 text-left text-slate-600 font-medium w-6"></th>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">Disease</th>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">ICD-10</th>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">Score / Threshold</th>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">Urgency</th>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-slate-600 font-medium">Rejection Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => {
                    const isOpen = expandedRows.has(c.disease_id);
                    const reason = getRejectionReason(c);
                    return (
                      <>
                        <motion.tr
                          key={c.disease_id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => toggleRow(c.disease_id)}
                          className={`border-t border-[#1e2d3d] cursor-pointer transition-colors ${
                            c.status === "valid"
                              ? "hover:bg-emerald-950/10"
                              : c.status === "excluded"
                              ? "hover:bg-red-950/10"
                              : "hover:bg-[#131b24]"
                          }`}
                        >
                          <td className="px-4 py-2.5 text-slate-600">
                            {isOpen ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`font-semibold ${c.status === "valid" ? "text-slate-100" : "text-slate-400"}`}>
                              {c.disease_name}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{c.icd10 ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-[#060a0f] rounded-full h-1.5 border border-[#162030]">
                                <div
                                  className={`h-full rounded-full ${c.status === "valid" ? "bg-emerald-500" : "bg-slate-600"}`}
                                  style={{ width: `${Math.min((c.score / (c.threshold ?? 1)) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-slate-400">
                                {c.score.toFixed(2)}
                                <span className="text-slate-600"> / {(c.threshold ?? 0).toFixed(2)}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded border text-xs ${urgencyToColor(c.urgency)}`}>
                              {urgencyToLabel(c.urgency)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded border text-xs ${statusColor(c.status)}`}>
                              {statusLabel(c.status)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">
                            {reason || <span className="text-slate-700">—</span>}
                          </td>
                        </motion.tr>
                        <AnimatePresence>
                          {isOpen && <ExpandedRow key={`${c.disease_id}-expanded`} candidate={c} />}
                        </AnimatePresence>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
