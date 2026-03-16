"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Clock, FileDown, Hash, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

import { exportToPDF } from "@/lib/exportReport";
import { urgencyToColor, urgencyToLabel, verdictToColor } from "@/lib/utils";
import { usePipelineStore } from "@/store/usePipelineStore";

export function DiagnosisCard() {
  const { result, clinicalText } = usePipelineStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      await exportToPDF(result, clinicalText);
    } finally {
      setExporting(false);
    }
  };
  if (!result) return null;

  const { primary_diagnosis, primary_icd10, urgency, confidence, explanation, verification, processing_time_ms, status } = result;
  const hasResult = status === "success" && primary_diagnosis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`rounded-2xl border p-6 ${hasResult ? "border-emerald-500/20 bg-gradient-to-br from-[#0d1117] to-emerald-950/10" : "border-[#1e2d3d] bg-[#0d1117]"}`}
    >
      {hasResult ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className={`flex items-center gap-1.5 font-mono text-xs font-bold tracking-widest ${verdictToColor(verification.graph_verdict)}`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {verification.graph_verdict}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono text-xs text-slate-600">
                <Clock className="h-3 w-3" />
                {processing_time_ms}ms
              </span>
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Export PDF Report"
                className="flex items-center gap-1.5 rounded-lg border border-[#1e2d3d] px-2.5 py-1 font-mono text-xs text-slate-400 transition-all hover:border-blue-500/30 hover:text-blue-400 disabled:opacity-40"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          </div>

          <h2 className="mb-1 text-2xl text-white">{primary_diagnosis}</h2>
          {primary_icd10 && (
            <div className="mb-4 flex items-center gap-1.5 font-mono text-xs text-slate-500">
              <Hash className="h-3 w-3" />
              ICD-10: {primary_icd10}
            </div>
          )}

          <div className="mb-4 flex items-center gap-3">
            <span className={`rounded-lg border px-3 py-1 font-mono text-xs font-bold ${urgencyToColor(urgency)}`}>{urgencyToLabel(urgency)}</span>
            <div className="h-2 flex-1 rounded-full border border-[#162030] bg-[#060a0f]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(confidence * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
              />
            </div>
            <span className="w-10 text-right font-mono text-xs text-slate-300">{Math.round(confidence * 100)}%</span>
          </div>

          <p className="border-t border-[#1e2d3d] pt-4 text-sm leading-relaxed text-slate-400">{explanation}</p>

          {verification.graph_verdict === "OVERRIDDEN" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-400">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Override applied.</strong> {verification.rejection_reason}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-200">Insufficient Data</p>
            <p className="text-sm text-slate-400">{explanation}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
