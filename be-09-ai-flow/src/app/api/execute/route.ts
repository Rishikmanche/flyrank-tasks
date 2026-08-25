import { NextRequest, NextResponse } from 'next/server';
import { askDecision } from '@/lib/ai';
import { ExecutionStep } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodes, edges, startNodeId } = body || {};

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: 'No nodes provided' }, { status: 400 });
    }

    const steps: ExecutionStep[] = [];
    let currentNodeId: string | null = startNodeId || nodes[0].id;
    const visited = new Set<string>();

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);
      const node = nodes.find((n: any) => n.id === currentNodeId);
      if (!node) break;

      const prompt = node.data?.prompt || 'Is this valid?';
      const label = node.data?.label || node.id;

      const decision = await askDecision(prompt);

      steps.push({
        nodeId: node.id,
        nodeLabel: label,
        prompt,
        decision,
        timestamp: Date.now(),
      });

      // Match edge by label or handle type
      const nextEdge = edges?.find((e: any) => {
        if (e.source !== currentNodeId) return false;
        const matchesLabel = e.label === decision;
        const matchesHandle = (decision === 'YES' && e.sourceHandle === 'yes') || (decision === 'NO' && e.sourceHandle === 'no');
        return matchesLabel || matchesHandle;
      });

      currentNodeId = nextEdge ? nextEdge.target : null;
    }

    return NextResponse.json({ steps, status: 'completed' });
  } catch (err: any) {
    console.error('Execute route error:', err);
    return NextResponse.json({ error: err.message || 'Execution failed', status: 'error' }, { status: 500 });
  }
}
