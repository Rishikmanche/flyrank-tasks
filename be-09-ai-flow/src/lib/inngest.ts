import { Inngest } from 'inngest';
import { askDecision } from './ai';
import { ExecutionStep } from '@/types';

export const inngest = new Inngest({ id: 'ai-decision-flow' });

interface WorkflowNode {
  id: string;
  data: { prompt: string; label: string };
}

interface WorkflowEdge {
  source: string;
  target: string;
  label?: string;
}

interface WorkflowPayload {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
}

export const aiDecisionWorkflow = inngest.createFunction(
  { id: 'execute-decision-flow', name: 'Execute AI Decision Flow' },
  { event: 'flow/execute' },
  async ({ event, step }) => {
    const { nodes, edges, startNodeId } = event.data as WorkflowPayload;
    const steps: ExecutionStep[] = [];
    let currentNodeId: string | null = startNodeId;
    const visited = new Set<string>();

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);
      const node = nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      const decision = await step.run(`decide-${node.id}`, async () => {
        return askDecision(node.data.prompt);
      });

      steps.push({
        nodeId: node.id,
        nodeLabel: node.data.label,
        prompt: node.data.prompt,
        decision,
        timestamp: Date.now(),
      });

      // Follow the matching edge
      const nextEdge = edges.find(
        (e) => e.source === currentNodeId && e.label === decision
      );
      currentNodeId = nextEdge ? nextEdge.target : null;
    }

    return { steps, status: 'completed' as const };
  }
);
