'use client';

import { useRef } from 'react';
import { useFlowStore } from '@/lib/store';

export default function Toolbar() {
  const {
    addNode,
    saveToLocal,
    exportJSON,
    importJSON,
    resetExecution,
    nodes,
    edges,
    executionStatus,
    setExecutionLog,
    setExecutionStatus,
    updateNodeStatus,
  } = useFlowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRun = async () => {
    if (nodes.length === 0) return;
    resetExecution();
    setExecutionStatus('running');

    // Find the root start node (node with no incoming edges or node-1)
    const targetIds = new Set(edges.map((e) => e.target));
    const startNode = nodes.find((n) => !targetIds.has(n.id)) || nodes[0];

    try {
      // Mark start node running
      updateNodeStatus(startNode.id, 'running');

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({ id: n.id, data: { prompt: n.data.prompt, label: n.data.label } })),
          edges: edges.map((e) => ({
            source: e.source,
            target: e.target,
            label: e.label,
            sourceHandle: e.sourceHandle,
          })),
          startNodeId: startNode.id,
        }),
      });

      const result = await res.json();

      if (result.steps && result.steps.length > 0) {
        // Animate node-by-node in sequence
        const logs = [];
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          updateNodeStatus(step.nodeId, 'running');
          await new Promise((r) => setTimeout(r, 450));

          updateNodeStatus(step.nodeId, step.decision === 'YES' ? 'yes' : 'no', step.decision);
          logs.push(step);
          setExecutionLog([...logs]);
          await new Promise((r) => setTimeout(r, 200));
        }

        setExecutionStatus('completed');
      } else {
        setExecutionStatus('error');
      }
    } catch (err) {
      console.error('Run workflow error:', err);
      setExecutionStatus('error');
    }
  };

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-decision-flow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importJSON(text);
    };
    reader.readAsText(file);
  };

  const btnBase = 'px-3 py-2 rounded text-xs font-bold transition-colors min-h-[36px] flex items-center gap-1';

  return (
    <div className="flex items-center gap-2 p-3 bg-slate-900 border-b border-slate-700 flex-wrap">
      <span className="text-sm font-bold text-white mr-2">⚡ AI Decision Flow</span>

      <button onClick={addNode} className={`${btnBase} bg-blue-600 hover:bg-blue-500 text-white`}>
        + Add Node
      </button>
      <button
        onClick={handleRun}
        disabled={executionStatus === 'running' || nodes.length === 0}
        className={`${btnBase} bg-green-600 hover:bg-green-500 text-white disabled:opacity-40`}
      >
        ▶ Run Workflow
      </button>
      <button onClick={resetExecution} className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-200`}>
        ↺ Reset
      </button>

      <div className="w-px h-6 bg-slate-700 mx-1" />

      <button onClick={saveToLocal} className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-200`}>
        💾 Save
      </button>
      <button onClick={handleExport} className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-200`}>
        📤 Export JSON
      </button>
      <button onClick={() => fileInputRef.current?.click()} className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-200`}>
        📥 Import JSON
      </button>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
    </div>
  );
}
