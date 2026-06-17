/**
 * KnowledgeGraphPage — Visual knowledge graph for agent memory
 * Extract entities and relationships from conversations
 */
import { useState, useEffect, useCallback } from "react";
import { Network, Search, Plus, Trash2, RefreshCw, ChevronRight, Database, GitBranch, Tag, Users } from "lucide-react";
import { GlassCard } from "../lib/components/ui/GlassCard";
import { GlassButton } from "../lib/components/ui/GlassButton";
import { GlassInput } from "../lib/components/ui/GlassInput";
import { GlassBadge } from "../lib/components/ui/GlassBadge";
import { GlassTabs } from "../lib/components/ui/GlassTabs";

interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  createdAt: string;
}

interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
}

interface GraphData {
  nodes: Array<{ id: string; name: string; type: string }>;
  edges: Array<{ id: string; source: string; target: string; type: string; weight: number }>;
}

// ─── Simple Graph Visualization ────────────────────────
function GraphVisualization({ graph }: { graph: GraphData }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const nodeColors: Record<string, string> = {
    person: "#818cf8",
    project: "#22c55e",
    concept: "#f59e0b",
    tool: "#6366f1",
    organization: "#ef4444",
    location: "#3b82f6",
    custom: "#94a3b8",
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (graph.nodes.length === 0) {
      ctx.fillStyle = "#475569";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No entities yet. Extract from a session or add manually.", width / 2, height / 2);
      return;
    }

    // Simple force-directed layout (basic)
    const positions: Record<string, { x: number; y: number }> = {};
    graph.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graph.nodes.length;
      const radius = Math.min(width, height) * 0.3;
      positions[node.id] = {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      };
    });

    // Draw edges
    ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
    ctx.lineWidth = 1;
    graph.edges.forEach(edge => {
      const from = positions[edge.source];
      const to = positions[edge.target];
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    graph.nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;
      const color = nodeColors[node.type] || "#94a3b8";
      const isSelected = node.id === selectedNode;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 20 : 16, 0, 2 * Math.PI);
      ctx.fillStyle = color + "33";
      ctx.fill();
      ctx.strokeStyle = isSelected ? color : color + "66";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Node label
      ctx.fillStyle = isSelected ? "#f1f5f9" : "#94a3b8";
      ctx.font = `${isSelected ? "bold " : ""}10px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(node.name.slice(0, 12), pos.x, pos.y + 28);
    });
  }, [graph, selectedNode]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={400}
      className="w-full rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]"
      onClick={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        // Find clicked node
        let clicked = null;
        graph.nodes.forEach((node, i) => {
          const angle = (2 * Math.PI * i) / graph.nodes.length;
          const radius = Math.min(canvas.width, canvas.height) * 0.3;
          const px = canvas.width / 2 + radius * Math.cos(angle);
          const py = canvas.height / 2 + radius * Math.sin(angle);
          const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
          if (dist < 20) clicked = node.id;
        });
        setSelectedNode(clicked);
      }}
    />
  );
}

import { useRef } from "react";

// ─── Main Component ────────────────────────────────────
export function KnowledgeGraphPage() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [entities, setEntities] = useState<Entity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [extractText, setExtractText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState("concept");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ entities: 0, relationships: 0 });

  useEffect(() => { loadGraph(); }, []);

  async function loadGraph() {
    setLoading(true);
    try {
      const res = await fetch("/api/kg/graph");
      if (res.ok) {
        const data = await res.json();
        setGraph(data);
        setEntities(data.nodes || []);
        setStats({ entities: data.nodes?.length || 0, relationships: data.edges?.length || 0 });
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function extractEntities() {
    if (!extractText.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/kg/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractText }),
      });
      if (res.ok) {
        setExtractText("");
        loadGraph();
      }
    } catch {}
    finally { setExtracting(false); }
  }

  async function addEntity() {
    if (!newEntityName.trim()) return;
    try {
      await fetch("/api/kg/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEntityName, type: newEntityType }),
      });
      setNewEntityName("");
      loadGraph();
    } catch {}
  }

  async function deleteEntity(id: string) {
    try {
      await fetch(`/api/kg/entity/${id}`, { method: "DELETE" });
      loadGraph();
    } catch {}
  }

  const entityTypes = ["person", "project", "concept", "tool", "organization", "location", "custom"];
  const typeColors: Record<string, string> = {
    person: "accent", project: "success", concept: "warning", tool: "default",
    organization: "error", location: "info", custom: "default",
  };

  const filteredEntities = searchQuery
    ? entities.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.type.includes(searchQuery.toLowerCase()))
    : entities;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
          <Network size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Knowledge Graph</h1>
          <p className="text-xs text-[#475569]">Entity extraction & relationship mapping from conversations</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard padding="sm" className="text-center">
          <p className="text-2xl font-bold text-white font-mono">{stats.entities}</p>
          <p className="text-[10px] text-[#475569] uppercase tracking-wider">Entities</p>
        </GlassCard>
        <GlassCard padding="sm" className="text-center">
          <p className="text-2xl font-bold text-white font-mono">{stats.relationships}</p>
          <p className="text-[10px] text-[#475569] uppercase tracking-wider">Relationships</p>
        </GlassCard>
        <GlassCard padding="sm" className="text-center">
          <p className="text-2xl font-bold text-white font-mono">{Object.keys(stats).length}</p>
          <p className="text-[10px] text-[#475569] uppercase tracking-wider">Types</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: Graph + Extract */}
        <div className="space-y-4">
          {/* Graph Visualization */}
          <GlassCard padding="md">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Graph Visualization</h3>
            {loading ? (
              <div className="h-[400px] animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl" />
            ) : (
              <GraphVisualization graph={graph} />
            )}
          </GlassCard>

          {/* Extract from Text */}
          <GlassCard padding="md">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Extract from Text</h3>
            <textarea
              value={extractText}
              onChange={e => setExtractText(e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm font-mono min-h-[100px] resize-y"
              placeholder="Paste text to extract entities and relationships..."
            />
            <GlassButton variant="primary" className="mt-3" onClick={extractEntities} loading={extracting} disabled={!extractText.trim()}>
              Extract Entities
            </GlassButton>
          </GlassCard>
        </div>

        {/* Right: Entity List + Add */}
        <div className="space-y-4">
          {/* Search */}
          <GlassInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search entities..."
            icon={<Search size={14} />}
          />

          {/* Add Entity */}
          <GlassCard padding="md">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Add Entity</h3>
            <div className="space-y-2">
              <GlassInput value={newEntityName} onChange={e => setNewEntityName(e.target.value)} placeholder="Entity name..." />
              <select
                value={newEntityType}
                onChange={e => setNewEntityType(e.target.value)}
                className="glass-input w-full px-3 py-2 text-xs"
              >
                {entityTypes.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <GlassButton variant="primary" size="sm" className="w-full" onClick={addEntity} icon={<Plus size={12} />}>
                Add Entity
              </GlassButton>
            </div>
          </GlassCard>

          {/* Entity List */}
          <GlassCard padding="md">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Entities ({filteredEntities.length})</h3>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredEntities.map(entity => (
                <div key={entity.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#475569]">
                      {entity.type === "person" ? <Users size={12} /> : entity.type === "tool" ? <Database size={12} /> : <Tag size={12} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{entity.name}</p>
                      <p className="text-[10px] text-[#475569]">{entity.type}</p>
                    </div>
                  </div>
                  <GlassBadge variant={typeColors[entity.type] as any || "default"}>{entity.type}</GlassBadge>
                </div>
              ))}
              {filteredEntities.length === 0 && (
                <p className="text-xs text-[#475569] text-center py-4">No entities found</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
