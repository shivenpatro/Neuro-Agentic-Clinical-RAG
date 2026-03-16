"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Network, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { usePipelineStore } from "@/store/usePipelineStore";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  icd10?: string;
  urgency?: string;
  description?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  weight: number;
}

interface Tooltip {
  x: number;
  y: number;
  node: GraphNode;
}

const NODE_COLORS: Record<string, string> = {
  symptom: "#3b82f6",
  disease: "#10b981",
};

const EDGE_COLORS: Record<string, string> = {
  SUGGESTS: "rgba(59,130,246,0.25)",
  REQUIRED_FOR: "rgba(168,85,247,0.35)",
  EXCLUDES: "rgba(239,68,68,0.3)",
};

const URGENCY_COLORS: Record<string, string> = {
  emergency: "#ef4444",
  urgent: "#f59e0b",
  routine: "#eab308",
  non_urgent: "#10b981",
};

export function GraphTopology() {
  const { result } = usePipelineStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [, setZoom] = useState(1); // Trigger re-render on zoom
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({ node: null, offsetX: 0, offsetY: 0 });
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

  const matchedSymptoms = result?.graph_result.matched_symptoms ?? [];
  const topDiseases = result?.graph_result.top_diagnoses.map((d) => d.disease_id) ?? [];

  const fetchTopology = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
      const res = await fetch(`${base}/api/graph/topology`, { signal });
      const data = await res.json();

      const W = canvasRef.current?.width ?? 800;
      const H = canvasRef.current?.height ?? 500;

      const initialized: GraphNode[] = data.nodes.map((n: GraphNode) => ({
        ...n,
        x: W / 2 + (Math.random() - 0.5) * 200, // Reduced spread init
        y: H / 2 + (Math.random() - 0.5) * 150,
        vx: 0,
        vy: 0,
      }));
      setNodes(initialized);
      nodesRef.current = initialized;
      setLinks(data.links);
      linksRef.current = data.links;
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        console.error("Failed to fetch topology", e);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTopology(controller.signal);
    return () => controller.abort();
  }, [fetchTopology]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ns = nodesRef.current;
    const ls = linksRef.current;
    const z = zoomRef.current;
    const p = panRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(z, z);

    const nodeById = new Map(ns.map((n) => [n.id, n]));

    // Draw edges
    for (const link of ls) {
      const a = nodeById.get(typeof link.source === "string" ? link.source : link.source.id);
      const b = nodeById.get(typeof link.target === "string" ? link.target : link.target.id);
      if (!a || !b) continue;
      const isActive =
        matchedSymptoms.includes(a.id) &&
        (topDiseases.includes(b.id) || matchedSymptoms.includes(b.id));
      ctx.beginPath();
      ctx.moveTo(a.x ?? 0, a.y ?? 0);
      ctx.lineTo(b.x ?? 0, b.y ?? 0);
      ctx.strokeStyle = isActive ? "rgba(59,130,246,0.8)" : (EDGE_COLORS[link.type] ?? "rgba(255,255,255,0.08)");
      ctx.lineWidth = isActive ? 2 : 0.8;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of ns) {
      const isMatchedSymptom = matchedSymptoms.includes(n.id);
      const isTopDisease = topDiseases.includes(n.id);
      const r = n.type === "disease" ? 8 : 5;
      const baseColor = n.type === "disease"
        ? (URGENCY_COLORS[n.urgency ?? ""] ?? NODE_COLORS.disease)
        : NODE_COLORS.symptom;

      if (isMatchedSymptom || isTopDisease) {
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isTopDisease ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = (isMatchedSymptom || isTopDisease) ? 1 : 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isMatchedSymptom || isTopDisease) {
        ctx.strokeStyle = isTopDisease ? "#10b981" : "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (isMatchedSymptom || isTopDisease || n.type === "disease") {
        ctx.fillStyle = isTopDisease ? "#10b981" : isMatchedSymptom ? "#93c5fd" : "#475569";
        ctx.font = `${isTopDisease ? "bold " : ""}${Math.max(8, 10 / z)}px monospace`;
        ctx.fillText(n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label, (n.x ?? 0) + r + 3, (n.y ?? 0) + 3);
      }
    }

    ctx.restore();
  }, [matchedSymptoms, topDiseases]);

  // Handle wheel zoom with non-passive listener to avoid console errors
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomRef.current = Math.max(0.2, Math.min(4, zoomRef.current * delta));
      setZoom(zoomRef.current);
      requestAnimationFrame(draw);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw]);

  // Physics Simulation
  useEffect(() => {
    const simulate = () => {
      const ns = nodesRef.current;
      const ls = linksRef.current;
      if (ns.length === 0) return;

      const nodeById = new Map(ns.map((n) => [n.id, n]));
      const W = canvasRef.current?.width ?? 800;
      const H = canvasRef.current?.height ?? 500;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i]; const b = ns[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          // Clamp distance to avoid singularity/explosion
          const dist = Math.sqrt(dx * dx + dy * dy);
          const safeDist = Math.max(dist, 30); 
          // Tune repulsion force down
          const force = 800 / (safeDist * safeDist); 
          
          const fx = (dx / safeDist) * force;
          const fy = (dy / safeDist) * force;

          a.vx = (a.vx ?? 0) - fx;
          a.vy = (a.vy ?? 0) - fy;
          b.vx = (b.vx ?? 0) + fx;
          b.vy = (b.vy ?? 0) + fy;
        }
      }

      // Attraction
      for (const link of ls) {
        const a = nodeById.get(typeof link.source === "string" ? link.source : link.source.id);
        const b = nodeById.get(typeof link.target === "string" ? link.target : link.target.id);
        if (!a || !b) continue;
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 80;
        const force = (dist - targetDist) * 0.02; // Reduced spring const
        
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        a.vx = (a.vx ?? 0) + fx;
        a.vy = (a.vy ?? 0) + fy;
        b.vx = (b.vx ?? 0) - fx;
        b.vy = (b.vy ?? 0) - fy;
      }

      // Center gravity (keep nodes visible)
      for (const n of ns) {
        n.vx = ((n.vx ?? 0) + ((W / 2 - (n.x ?? 0)) * 0.005));
        n.vy = ((n.vy ?? 0) + ((H / 2 - (n.y ?? 0)) * 0.005));
        
        // Velocity damping
        n.vx! *= 0.85;
        n.vy! *= 0.85;
        
        // Update position
        n.x = (n.x ?? 0) + (n.vx ?? 0);
        n.y = (n.y ?? 0) + (n.vy ?? 0);
      }

      draw();
      animRef.current = requestAnimationFrame(simulate);
    };

    if (nodes.length > 0) {
      animRef.current = requestAnimationFrame(simulate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length, matchedSymptoms, topDiseases, draw]);

  // Mouse interactions
  const getNodeAt = (ex: number, ey: number): GraphNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (ex - rect.left - panRef.current.x) / zoomRef.current;
    const y = (ey - rect.top - panRef.current.y) / zoomRef.current;
    for (const n of nodesRef.current) {
      const dx = (n.x ?? 0) - x;
      const dy = (n.y ?? 0) - y;
      if (Math.sqrt(dx * dx + dy * dy) < 15) return n; // Hit radius
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) {
      dragRef.current = { node, offsetX: e.clientX - (node.x ?? 0) * zoomRef.current - panRef.current.x, offsetY: e.clientY - (node.y ?? 0) * zoomRef.current - panRef.current.y };
    } else {
      isPanning.current = true;
      lastPan.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current.node) {
      dragRef.current.node.x = (e.clientX - dragRef.current.offsetX - panRef.current.x) / zoomRef.current;
      dragRef.current.node.y = (e.clientY - dragRef.current.offsetY - panRef.current.y) / zoomRef.current;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
    } else if (isPanning.current) {
      panRef.current = { x: e.clientX - lastPan.current.x, y: e.clientY - lastPan.current.y };
      requestAnimationFrame(draw);
    }
    const hover = getNodeAt(e.clientX, e.clientY);
    if (hover) {
      const rect = canvasRef.current?.getBoundingClientRect();
      setTooltip({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), node: hover });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseUp = () => {
    dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
    isPanning.current = false;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-[#0d1117] border border-[#1e2d3d] rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d3d]">
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-widest">
            Knowledge Graph
          </span>
          <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-[#060a0f] border border-[#1e2d3d] text-slate-500">
            {nodes.length} nodes · {links.length} edges
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { zoomRef.current = Math.min(4, zoomRef.current * 1.2); setZoom(zoomRef.current); requestAnimationFrame(draw); }} className="p-1.5 rounded-lg border border-[#1e2d3d] text-slate-500 hover:text-slate-300 transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => { zoomRef.current = Math.max(0.2, zoomRef.current * 0.8); setZoom(zoomRef.current); requestAnimationFrame(draw); }} className="p-1.5 rounded-lg border border-[#1e2d3d] text-slate-500 hover:text-slate-300 transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={fetchTopology} className="p-1.5 rounded-lg border border-[#1e2d3d] text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-5 py-2 border-b border-[#1e2d3d] bg-[#060a0f]">
        {[
          { color: "#3b82f6", label: "Symptom" },
          { color: "#10b981", label: "Disease (active)" },
          { color: "rgba(59,130,246,0.8)", label: "SUGGESTS", line: true },
          { color: "rgba(168,85,247,0.6)", label: "REQUIRED_FOR", line: true },
          { color: "rgba(239,68,68,0.6)", label: "EXCLUDES", line: true },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            {item.line ? (
              <div className="w-5 h-0.5 rounded" style={{ background: item.color }} />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
            )}
            <span className="text-xs font-mono text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="relative" style={{ height: 480 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={900}
          height={480}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ background: "#060a0f" }}
        />
        {tooltip && (
          <div
            className="absolute pointer-events-none z-20 bg-[#0d1117] border border-[#1e2d3d] rounded-xl p-3 text-xs font-mono shadow-xl max-w-48"
            style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
          >
            <p className="text-slate-200 font-semibold mb-1">{tooltip.node.label}</p>
            <p className="text-slate-500 capitalize">{tooltip.node.type}</p>
            {tooltip.node.icd10 && <p className="text-blue-400">ICD-10: {tooltip.node.icd10}</p>}
            {tooltip.node.urgency && <p className="text-amber-400 capitalize">{tooltip.node.urgency}</p>}
            {tooltip.node.description && (
              <p className="text-slate-600 mt-1 leading-tight">{tooltip.node.description.slice(0, 80)}…</p>
            )}
          </div>
        )}
        <div className="absolute bottom-3 right-3 text-xs font-mono text-slate-700">
          Zoom: {Math.round(zoomRef.current * 100)}% · Drag nodes or canvas to explore
        </div>
      </div>
    </motion.div>
  );
}
