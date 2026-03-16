"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, Pill, Loader2, Info } from "lucide-react";
import { checkDrugs, type DrugCheckResult } from "@/lib/api";
import { usePipelineStore } from "@/store/usePipelineStore";

interface DrugCardProps {
  drug: DrugCheckResult["suggested_drugs"][number];
}

function DrugCard({ drug }: DrugCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#1e2d3d] bg-[#060a0f] p-3 cursor-pointer hover:border-emerald-500/20 transition-colors"
      onClick={() => setExpanded((p) => !p)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-mono font-semibold text-slate-200">{drug.name}</p>
          {drug.generic_name && drug.generic_name !== drug.name && (
            <p className="text-xs text-slate-500 font-mono">{drug.generic_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {drug.route && (
            <span className="px-1.5 py-0.5 text-xs font-mono bg-blue-950/30 border border-blue-500/20 rounded text-blue-400">
              {drug.route}
            </span>
          )}
        </div>
      </div>
      <AnimatePresence>
        {expanded && drug.warnings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-2 pt-2 border-t border-[#1e2d3d] text-xs text-amber-400/80 font-mono leading-relaxed">
              {drug.warnings}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function DrugPanel() {
  const { result, stage } = usePipelineStore();
  const [drugData, setDrugData] = useState<DrugCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stage !== "complete" || !result?.primary_diagnosis) return null;

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkDrugs(result.primary_diagnosis!);
      setDrugData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch drug data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-[#0d1117] border border-[#1e2d3d] rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d3d]">
        <div className="flex items-center gap-2">
          <Pill className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-widest">
            Drug Interactions
          </span>
          <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-[#060a0f] border border-[#1e2d3d] text-slate-500">
            {result.primary_diagnosis}
          </span>
        </div>
        {!drugData && (
          <button
            onClick={handleCheck}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-mono text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pill className="w-3 h-3" />}
            {loading ? "Fetching..." : "Check Drugs"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-5 py-3 text-xs font-mono text-red-400 bg-red-950/20 border-b border-[#1e2d3d]"
          >
            {error}
          </motion.div>
        )}

        {drugData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-5 space-y-4"
          >
            {/* Suggested medications */}
            <div>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">
                Suggested First-Line Medications ({drugData.suggested_drugs.length})
              </p>
              {drugData.suggested_drugs.length > 0 ? (
                <div className="space-y-2">
                  {drugData.suggested_drugs.map((drug, i) => (
                    <DrugCard key={i} drug={drug} />
                  ))}
                </div>
              ) : (
                <p className="text-sm font-mono text-slate-600">
                  No drugs found in OpenFDA for this diagnosis.
                </p>
              )}
            </div>

            {/* Interactions */}
            {drugData.interactions.length > 0 && (
              <div>
                <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">
                  Potential Interactions ({drugData.interactions.length})
                </p>
                <div className="space-y-2">
                  {drugData.interactions.map((ix, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-red-500/20 bg-red-950/20 p-3 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-mono font-semibold text-red-300 mb-1">
                          {typeof ix.severity === "string" ? ix.severity.toUpperCase() : "UNKNOWN"} — {(ix.drugs as string[])?.join(" + ")}
                        </p>
                        <p className="text-xs text-red-400/70 font-mono">{ix.description as string}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drugData.interactions.length === 0 && drugData.suggested_drugs.length > 1 && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <p className="text-xs font-mono text-emerald-400">No known interactions detected between listed medications.</p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 rounded-xl border border-[#1e2d3d] bg-[#060a0f] p-3">
              <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <p className="text-xs font-mono text-slate-600 leading-relaxed">{drugData.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
