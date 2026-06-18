/**
 * WorkflowsPage v2 — Visual Workflow Builder (ReactFlow-based)
 */
import { useState, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, BackgroundVariant, Panel, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, Save, Play, Plus, Hexagon } from "lucide-react";

// ─── Custom Nodes ───────────────────────────
function StartNode({ data }: any) {
  return (
    <div className="px-4 py-2 rounded-xl bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] text-[#10b981] text-xs font-semibold min-w-[100px] text-center">
      <Handle type="source" position={Position.Bottom} className="!bg-[#10b981]" />
      ▶ {data.label || 'Start'}
    </div>
  );
}
function AgentNode({ data }: any) {
  return (
    <div className="px-4 py-2 rounded-xl bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.3)] text-[#818cf8] text-xs font-semibold min-w-[120px]">
      <Handle type="target" position={Position.Top} className="!bg-[#6366f1]" />
      <div className="flex items-center gap-2"><span>🤖</span> {data.label || 'Agent'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#6366f1]" />
    </div>
  );
}
function ToolNode({ data }: any) {
  return (
    <div className="px-4 py-2 rounded-xl bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.3)] text-[#fbbf24] text-xs font-semibold min-w-[120px]">
      <Handle type="target" position={Position.Top} className="!bg-[#f59e0b]" />
      <div className="flex items-center gap-2"><span>🔧</span> {data.label || 'Tool'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#f59e0b]" />
    </div>
  );
}
function ConditionNode({ data }: any) {
  return (
    <div className="px-4 py-2 rounded-xl bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#fca5a5] text-xs font-semibold min-w-[100px] text-center diamond-shape">
      <Handle type="target" position={Position.Top} className="!bg-[#ef4444]" />
      {data.label || 'If/Else'}
      <Handle type="source" position={Position.Bottom} className="!bg-[#ef4444]" id="true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} className="!bg-[#ef4444]" id="false" style={{ left: '70%' }} />
    </div>
  );
}
function EndNode({ data }: any) {
  return (
    <div className="px-4 py-2 rounded-xl bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#fca5a5] text-xs font-semibold min-w-[100px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-[#ef4444]" />
      ⏹ {data.label || 'End'}
    </div>
  );
}

const nodeTypes = { start: StartNode, agent: AgentNode, tool: ToolNode, condition: ConditionNode, end: EndNode };
let nodeId = 0;

export function WorkflowsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    { id: 'start-1', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start' } },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState("New Workflow");
  const [saved, setSaved] = useState(false);

  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)), [setEdges]);

  const addNode = (type: string) => {
    const id = `node-${++nodeId}`;
    const labels: Record<string, string> = { agent: 'Agent', tool: 'Tool', condition: 'If/Else', end: 'End' };
    setNodes(nds => [...nds, { id, type, position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 300 }, data: { label: labels[type] || type } }]);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-[#00d4ff]" />
          </div>
          <div>
            <input value={workflowName} onChange={e => setWorkflowName(e.target.value)}
              className="text-lg font-semibold bg-transparent text-[#e8ecf2] border-none outline-none placeholder-[#4a5068]"
            />
            <p className="text-xs text-[#4a5068]">{nodes.length} nodes · {edges.length} connections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#8892a8] hover:text-[#e8ecf2] hover:bg-[rgba(255,255,255,0.06)] transition-all text-sm flex items-center gap-2">
            <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save'}
          </button>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#6366f1] text-white font-semibold text-sm hover:shadow-[0_4px_20px_rgba(0,212,255,0.3)] transition-all flex items-center gap-2">
            <Play className="w-4 h-4" /> Run
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} nodeTypes={nodeTypes} fitView defaultViewport={{ x: 50, y: 50, zoom: 0.85 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.04)" />
          <Controls className="!bg-[#0d0f20] !border-[rgba(255,255,255,0.08)] !rounded-xl !overflow-hidden" />
          <MiniMap className="!bg-[#0d0f20] !border-[rgba(255,255,255,0.08)] !rounded-xl" maskColor="rgba(0,0,0,0.5)" nodeColor="#6366f1" />
          
          {/* Node Palette */}
          <Panel position="top-left" className="!m-3">
            <div className="flex gap-1.5 p-2 rounded-xl bg-[rgba(10,11,30,0.95)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] shadow-xl">
              <button onClick={() => addNode('agent')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.2)] text-[#818cf8] hover:brightness-125 transition-all flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Agent
              </button>
              <button onClick={() => addNode('tool')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.2)] text-[#fbbf24] hover:brightness-125 transition-all flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Tool
              </button>
              <button onClick={() => addNode('condition')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.2)] text-[#fca5a5] hover:brightness-125 transition-all flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Condition
              </button>
              <button onClick={() => addNode('end')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.2)] text-[#fca5a5] hover:brightness-125 transition-all flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> End
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
