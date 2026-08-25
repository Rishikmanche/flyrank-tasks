'use client';

import { ExecutionStep } from '@/types';
import { useFlowStore } from '@/lib/store';

export default function ExecutionLog() {
  const executionLog = useFlowStore((s) => s.executionLog);
  const executionStatus = useFlowStore((s) => s.executionStatus);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Execution Log</h3>
        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
          executionStatus === 'running' ? 'bg-blue-900 text-blue-300 animate-pulse' :
          executionStatus === 'completed' ? 'bg-green-900 text-green-300' :
          executionStatus === 'error' ? 'bg-red-900 text-red-300' :
          'bg-slate-800 text-slate-400'
        }`}>
          {executionStatus.toUpperCase()}
        </span>
      </div>

      {executionLog.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No execution yet. Add nodes and click Run.</p>
      ) : (
        <div className="space-y-2">
          {executionLog.map((step, i) => (
            <div key={i} className="bg-slate-800 rounded p-3 border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-300">Step {i + 1}: {step.nodeLabel}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  step.decision === 'YES' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
                }`}>
                  {step.decision}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">&quot;{step.prompt}&quot;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
