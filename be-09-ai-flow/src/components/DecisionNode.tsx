'use client';

import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useFlowStore } from '@/lib/store';
import { DecisionNodeData } from '@/types';

const statusColors: Record<string, string> = {
  idle: 'border-slate-600 bg-slate-800',
  running: 'border-blue-500 bg-blue-950 animate-pulse',
  yes: 'border-green-500 bg-green-950',
  no: 'border-red-500 bg-red-950',
  error: 'border-orange-500 bg-orange-950',
};

const statusBadge: Record<string, string> = {
  idle: '⏸ Idle',
  running: '⚡ Running...',
  yes: '✅ YES',
  no: '❌ NO',
  error: '⚠️ Error',
};

function DecisionNode({ id, data }: NodeProps) {
  const nodeData = data as unknown as DecisionNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nodeData.prompt);
  const updateNodePrompt = useFlowStore((s) => s.updateNodePrompt);

  const commitEdit = useCallback(() => {
    updateNodePrompt(id, draft);
    setEditing(false);
  }, [id, draft, updateNodePrompt]);

  return (
    <div className={`rounded-lg border-2 p-4 min-w-[240px] max-w-[300px] text-white shadow-lg ${statusColors[nodeData.status] || statusColors.idle}`}>
      {/* Top input handle */}
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{nodeData.label}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-700">{statusBadge[nodeData.status] || statusBadge.idle}</span>
      </div>

      {/* Prompt */}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && commitEdit()}
          autoFocus
          rows={3}
          className="w-full bg-slate-900 text-sm text-white p-2 rounded border border-slate-500 resize-none focus:outline-none focus:border-blue-400"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="text-sm cursor-pointer hover:bg-slate-700/50 p-2 rounded transition-colors"
          title="Click to edit prompt"
        >
          {nodeData.prompt}
        </p>
      )}

      {/* Result display */}
      {nodeData.result && (
        <div className="mt-2 text-xs text-slate-400 font-mono">
          Result: <span className="text-white font-bold">{nodeData.result}</span>
        </div>
      )}

      {/* YES / NO output handles */}
      <div className="flex justify-between mt-3 text-xs font-bold">
        <div className="flex flex-col items-center">
          <span className="text-green-400 mb-1">YES</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!bg-green-500 !w-3 !h-3 !relative !transform-none !left-0 !-bottom-0"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-red-400 mb-1">NO</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!bg-red-500 !w-3 !h-3 !relative !transform-none !right-0 !-bottom-0"
          />
        </div>
      </div>
    </div>
  );
}

export default memo(DecisionNode);
