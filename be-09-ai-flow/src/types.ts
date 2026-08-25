export interface DecisionNodeData {
  [key: string]: unknown;
  prompt: string;
  label: string;
  status: 'idle' | 'running' | 'yes' | 'no' | 'error';
  result?: string;
}

export interface ExecutionStep {
  nodeId: string;
  nodeLabel: string;
  prompt: string;
  decision: 'YES' | 'NO';
  timestamp: number;
}

export interface ExecutionResult {
  steps: ExecutionStep[];
  status: 'completed' | 'error' | 'no-path';
  error?: string;
}

export interface WorkflowExport {
  nodes: any[];
  edges: any[];
  exportedAt: string;
}
