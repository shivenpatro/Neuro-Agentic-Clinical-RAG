"use client";

import { motion } from "framer-motion";
import { AlertCircle, RotateCcw, Send, Stethoscope } from "lucide-react";

import { usePipelineStream } from "@/hooks/usePipelineStream";
import { usePipelineStore } from "@/store/usePipelineStore";
import { Button } from "@/components/ui/button";

const EXAMPLE_CASES = [
  {
    label: "Appendicitis",
    text: "Patient presents with sharp lower right quadrant abdominal pain for 18 hours, mild fever of 38.2°C, nausea, and loss of appetite. Rebound tenderness noted on examination.",
  },
  {
    label: "Cardiac Event",
    text: "55-year-old male with crushing chest pain radiating to the left arm, diaphoresis, shortness of breath, and mild nausea. Onset 30 minutes ago.",
  },
  {
    label: "Migraine",
    text: "Patient reports severe throbbing headache, photophobia, phonophobia, and nausea. Visual aura preceded the headache by 20 minutes.",
  },
];

export function InputPanel() {
  const { clinicalText, setClinicalText, isLoading, reset, stage } = usePipelineStore();
  const { runPipeline } = usePipelineStream();
  const isComplete = stage === "complete" || stage === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
          <Stethoscope className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-semibold tracking-wide text-slate-200 uppercase">Clinical Input</h2>
          <p className="text-xs text-slate-500">Enter unstructured patient notes or symptoms</p>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={clinicalText}
          onChange={(event) => setClinicalText(event.target.value)}
          disabled={isLoading}
          placeholder="Patient presents with..."
          rows={6}
          className="w-full resize-none rounded-xl border border-[#1e2d3d] bg-[#0d1117] p-4 font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="absolute right-3 bottom-3 font-mono text-xs text-slate-600">{clinicalText.length}/2000</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="mr-1 self-center text-xs text-slate-600">Try:</span>
        {EXAMPLE_CASES.map((example) => (
          <button
            key={example.label}
            onClick={() => setClinicalText(example.text)}
            disabled={isLoading}
            className="rounded-full border border-[#1e2d3d] px-3 py-1 text-xs text-slate-400 transition-all hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {example.label}
          </button>
        ))}
      </div>

      {clinicalText.length > 0 && clinicalText.length < 20 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 flex items-center gap-2 text-xs text-amber-400/80">
          <AlertCircle className="h-3 w-3" />
          <span>Please provide more clinical detail for accurate analysis.</span>
        </motion.div>
      )}

      <div className="mt-4 flex gap-3">
        <Button
          onClick={runPipeline}
          disabled={isLoading || clinicalText.trim().length < 20}
          className="h-10 flex-1 bg-blue-600 font-mono text-sm text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5" />
              Run Analysis
            </span>
          )}
        </Button>

        {isComplete && (
          <Button
            onClick={reset}
            variant="outline"
            className="h-10 border-[#1e2d3d] px-4 font-mono text-sm text-slate-400 hover:bg-[#131b24] hover:text-slate-200"
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
    </motion.div>
  );
}
