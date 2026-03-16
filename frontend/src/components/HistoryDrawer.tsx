"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, LogOut, Trash2, X, User, ChevronRight, Loader2 } from "lucide-react";
import { fetchHistory, fetchCaseDetail, deleteCase, type CaseSummary } from "@/lib/api";
import { urgencyToColor, urgencyToLabel } from "@/lib/utils";
import type { UrgencyLevel } from "@/types/pipeline";
import { useAuthStore } from "@/store/useAuthStore";
import { usePipelineStore } from "@/store/usePipelineStore";

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login, register, isLoading, error } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = mode === "login" ? await login(username, password) : await register(username, password);
    if (ok) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-5">
      <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
        {mode === "login" ? "Sign in to view history" : "Create account"}
      </p>
      <input
        className="w-full rounded-lg border border-[#1e2d3d] bg-[#060a0f] px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        className="w-full rounded-lg border border-[#1e2d3d] bg-[#060a0f] px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-blue-500/20 border border-blue-500/30 px-4 py-2 text-sm font-mono text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-40"
      >
        {isLoading ? "Please wait..." : mode === "login" ? "Sign In" : "Register"}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="w-full text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
      >
        {mode === "login" ? "No account? Register" : "Have account? Sign in"}
      </button>
      <p className="text-xs font-mono text-slate-700">
        Default admin: <span className="text-slate-500">admin / changeme</span>
      </p>
    </form>
  );
}

function CaseCard({
  c,
  onLoad,
  onDelete,
}: {
  c: CaseSummary;
  onLoad: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="border border-[#1e2d3d] rounded-xl p-3 hover:border-blue-500/20 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold text-slate-200 truncate">
            {c.primary_diagnosis ?? "Insufficient Data"}
          </p>
          <p className="text-xs font-mono text-slate-600">
            {new Date(c.created_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`px-1.5 py-0.5 text-xs font-mono rounded border shrink-0 ${urgencyToColor(
            (c.urgency ?? "unknown") as UrgencyLevel
          )}`}
        >
          {urgencyToLabel((c.urgency ?? "unknown") as UrgencyLevel)}
        </span>
      </div>
      <p className="text-xs text-slate-600 font-mono mb-2 leading-tight line-clamp-2">
        {c.input_preview}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onLoad(c.id)}
          className="flex items-center gap-1 text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ChevronRight className="w-3 h-3" /> Load case
        </button>
        <span className="text-slate-700 text-xs">{Math.round(c.confidence * 100)}% confidence</span>
        <button
          onClick={() => onDelete(c.id)}
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-700 hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

export function HistoryDrawer() {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCase, setLoadingCase] = useState<number | null>(null);
  const { token, username, logout, loadFromStorage } = useAuthStore();
  const { setClinicalText } = usePipelineStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const loadCases = () => {
    setLoading(true);
    fetchHistory()
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && token) loadCases();
  }, [open, token]);

  const handleDelete = async (id: number) => {
    try {
      await deleteCase(id);
      setCases((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
  };

  // Fetch the full case (not the truncated preview) and populate the input
  const handleLoad = async (id: number) => {
    setLoadingCase(id);
    try {
      const detail = await fetchCaseDetail(id);
      setClinicalText(detail.input_text);
      setOpen(false);
    } catch {
      // Fallback to preview text
      const c = cases.find((x) => x.id === id);
      if (c) setClinicalText(c.input_preview);
      setOpen(false);
    } finally {
      setLoadingCase(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Case History"
        className="flex items-center gap-1.5 rounded-lg border border-[#1e2d3d] px-2.5 py-1.5 font-mono text-xs text-slate-400 transition-all hover:border-blue-500/30 hover:text-blue-400"
      >
        <History className="h-3.5 w-3.5" />
        History
        {username && <span className="text-slate-600">({username})</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-80 bg-[#0d1117] border-l border-[#1e2d3d] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d3d] shrink-0">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span className="font-mono text-sm font-semibold text-slate-200">Case History</span>
                </div>
                <div className="flex items-center gap-2">
                  {token && (
                    <button
                      onClick={logout}
                      title="Sign out"
                      className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {!token ? (
                  // Single login form — no duplicate
                  <LoginForm onSuccess={loadCases} />
                ) : loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                ) : cases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-700">
                    <User className="w-8 h-8 opacity-30" />
                    <p className="text-xs font-mono">No cases saved yet</p>
                    <p className="text-xs font-mono text-slate-700">
                      Run an analysis to save your first case.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-mono text-slate-600 px-1 pb-1">
                      {cases.length} saved case(s)
                    </p>
                    <AnimatePresence>
                      {cases.map((c) => (
                        <div key={c.id} className="relative">
                          {loadingCase === c.id && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d1117]/80 rounded-xl">
                              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            </div>
                          )}
                          <CaseCard c={c} onLoad={handleLoad} onDelete={handleDelete} />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
