import { NextRequest, NextResponse } from 'next/server';
import { askDecision } from '@/lib/ai';
import { ExecutionStep } from '@/types';

// ponytail: Direct execution endpoint (works without Inngest dev server running)
// Mirrors the Inngest workflow logic so the demo works standalone
export async function POST(req: NextRequest) {
  try {
    const { nodes, edges, startNodeId } = await req.json();

    if (!nodes?.length || !startNodeId) {
      return NextResponse.json({ error: 'Missing nodes or startNodeId' }, { status: 400 });
    }

    const steps: ExecutionStep[] = [];
    let currentNodeId: string | null = startNodeId;
    const visited = new Set<string>();

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);
      const node = nodes.find((n: any) => n.id === currentNodeId);
      if (!node) break;

      const decision = await askDecision(node.data.prompt);

      steps.push({
        nodeId: node.id,
        nodeLabel: node.data.label,
        prompt: node.data.prompt,
        decision,
        timestamp: Date.now(),
      });

      const nextEdge = edges.find(
        (e: any) => e.source === currentNodeId && e.label === decision
      );
      currentNodeId = nextEdge ? nextEdge.target : null;
    }

    return NextResponse.json({ steps, status: 'completed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: 'error' }, { status: 500 });
  }
}
