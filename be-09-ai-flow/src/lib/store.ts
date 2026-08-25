import { create } from 'zustand';
import { Node, Edge, addEdge, applyNodeChanges, applyEdgeChanges, Connection, NodeChange, EdgeChange } from 'reactflow';
import { DecisionNodeData, ExecutionStep, ExecutionResult } from '@/types';

const STORAGE_KEY = 'ai-flow-graph';

interface FlowStore {
  nodes: Node<DecisionNodeData>[];
  edges: Edge[];
  executionLog: ExecutionStep[];
  executionStatus: 'idle' | 'running' | 'completed' | 'error';
  nodeCounter: number;

  addNode: () => void;
  updateNodePrompt: (id: string, prompt: string) => void;
  updateNodeStatus: (id: string, status: DecisionNodeData['status'], result?: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  setExecutionLog: (log: ExecutionStep[]) => void;
  setExecutionStatus: (status: FlowStore['executionStatus']) => void;
  resetExecution: () => void;

  saveToLocal: () => void;
  loadFromLocal: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: [
    {
      id: 'node-1',
      type: 'decision',
      position: { x: 250, y: 100 },
      data: {
        prompt: 'Is this a customer support request?',
        label: 'Decision 1 (Root)',
        status: 'idle',
      },
    },
    {
      id: 'node-2',
      type: 'decision',
      position: { x: 80, y: 300 },
      data: {
        prompt: 'Is the customer on an enterprise plan?',
        label: 'Decision 2 (Support)',
        status: 'idle',
      },
    },
    {
      id: 'node-3',
      type: 'decision',
      position: { x: 420, y: 300 },
      data: {
        prompt: 'Is this an enterprise sales lead?',
        label: 'Decision 3 (Sales)',
        status: 'idle',
      },
    },
  ],
  edges: [
    {
      id: 'e-node-1-node-2-YES',
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'yes',
      label: 'YES',
      style: { stroke: '#22c55e', strokeWidth: 2 },
      type: 'default',
    },
    {
      id: 'e-node-1-node-3-NO',
      source: 'node-1',
      target: 'node-3',
      sourceHandle: 'no',
      label: 'NO',
      style: { stroke: '#ef4444', strokeWidth: 2 },
      type: 'default',
    },
  ],
  executionLog: [],
  executionStatus: 'idle',
  nodeCounter: 3,

  addNode: () => {
    const count = get().nodeCounter + 1;
    const newNode: Node<DecisionNodeData> = {
      id: `node-${count}`,
      type: 'decision',
      position: { x: 200 + (count % 3) * 220, y: 120 + Math.floor(count / 3) * 160 },
      data: {
        prompt: 'Is this a high priority task?',
        label: `Decision ${count}`,
        status: 'idle',
      },
    };
    set((s) => ({ nodes: [...s.nodes, newNode], nodeCounter: count }));
  },

  updateNodePrompt: (id, prompt) => {
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, prompt } } : n),
    }));
  },

  updateNodeStatus: (id, status, result) => {
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, status, result } } : n),
    }));
  },

  onNodesChange: (changes) => {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as Node<DecisionNodeData>[] }));
  },

  onEdgesChange: (changes) => {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
  },

  onConnect: (connection) => {
    const edgeType = connection.sourceHandle === 'yes' ? 'YES' : 'NO';
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${edgeType}-${Date.now()}`,
      label: edgeType,
      style: { stroke: edgeType === 'YES' ? '#22c55e' : '#ef4444', strokeWidth: 2 },
      type: 'default',
    } as Edge;
    set((s) => ({ edges: addEdge(newEdge, s.edges) }));
  },

  setExecutionLog: (log) => set({ executionLog: log }),
  setExecutionStatus: (status) => set({ executionStatus: status }),

  resetExecution: () => {
    set((s) => ({
      executionLog: [],
      executionStatus: 'idle',
      nodes: s.nodes.map((n) => ({ ...n, data: { ...n.data, status: 'idle' as const, result: undefined } })),
      edges: s.edges.map((e) => ({ ...e, animated: false })),
    }));
  },

  saveToLocal: () => {
    const { nodes, edges, nodeCounter } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, nodeCounter }));
  },

  loadFromLocal: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { nodes, edges, nodeCounter } = JSON.parse(raw);
      if (Array.isArray(nodes) && nodes.length > 0) {
        set({ nodes, edges, nodeCounter });
      }
    } catch { /* ignore corrupt storage */ }
  },

  exportJSON: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges, exportedAt: new Date().toISOString() }, null, 2);
  },

  importJSON: (json) => {
    try {
      const { nodes, edges } = JSON.parse(json);
      const maxId = nodes.reduce((max: number, n: Node) => {
        const num = parseInt(n.id.replace('node-', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      set({ nodes, edges, nodeCounter: maxId, executionLog: [], executionStatus: 'idle' });
    } catch (e) {
      console.error('Import failed:', e);
    }
  },
}));
