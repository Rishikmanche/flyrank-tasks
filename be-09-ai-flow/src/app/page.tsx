'use client';

import FlowEditor from '@/components/FlowEditor';
import ExecutionLog from '@/components/ExecutionLog';
import Toolbar from '@/components/Toolbar';

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <FlowEditor />
        <div className="w-80 border-l border-slate-700 p-0">
          <ExecutionLog />
        </div>
      </div>
    </div>
  );
}
