import { createMMKV } from 'react-native-mmkv';
import { StudentKnowledgeMap } from '../memory/MemoryCondenser';

const storage = createMMKV({ id: 'padh-knowledge-graph' });

export interface GraphNode extends StudentKnowledgeMap {
  id: string;
  label: string;
  subject: string;
  x: number; // 0 to 1 relative coordinate
  y: number; // 0 to 1 relative coordinate
  size: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related';
}

// Removed hardcoded default nodes and edges. 
// We now return an empty graph if the student hasn't started learning.

class KnowledgeGraphBuilderService {
  /**
   * Fetches the student's current knowledge DAG (Directed Acyclic Graph).
   */
  public getGraph(): { nodes: GraphNode[], edges: GraphEdge[] } {
    const storedNodesStr = storage.getString('graph_nodes');
    const storedEdgesStr = storage.getString('graph_edges');
    
    // Return empty arrays if no graph exists
    const nodes = storedNodesStr ? JSON.parse(storedNodesStr) : [];
    const edges = storedEdgesStr ? JSON.parse(storedEdgesStr) : [];
    
    return { nodes, edges };
  }

  /**
   * Updates a specific node's confidence and stores it.
   */
  public updateNodeConfidence(id: string, confidence: number, weakPoints: string[] = []): void {
    const { nodes } = this.getGraph();
    const nodeIndex = nodes.findIndex((n: GraphNode) => n.id === id);
    if (nodeIndex > -1) {
      nodes[nodeIndex].confidence = confidence;
      nodes[nodeIndex].weakPoints = weakPoints;
      storage.set('graph_nodes', JSON.stringify(nodes));
    }
  }

  /**
   * Generate AI insights based on the graph state.
   */
  public getInsights(): { type: 'strength' | 'weakness' | 'suggestion', text: string, icon: string }[] {
    const { nodes, edges } = this.getGraph();
    const insights: { type: 'strength' | 'weakness' | 'suggestion', text: string, icon: string }[] = [];

    // Find strongest topic
    const sortedByConfidence = [...nodes].sort((a, b) => b.confidence - a.confidence);
    const strongest = sortedByConfidence[0];
    if (strongest && strongest.confidence > 70) {
      insights.push({
        type: 'strength',
        text: `${strongest.label} is your strongest topic at ${strongest.confidence}% confidence. Great foundation!`,
        icon: '💪'
      });
    }

    // Find blockages (weak prereq)
    for (const edge of edges.filter((e: GraphEdge) => e.type === 'prerequisite')) {
      const from = nodes.find((n: GraphNode) => n.id === edge.from);
      const to = nodes.find((n: GraphNode) => n.id === edge.to);
      if (from && to && from.confidence < 40 && to.confidence === 0) {
        insights.push({
          type: 'weakness',
          text: `${from.label} (${from.confidence}%) is blocking ${to.label}. Focus on clearing "${from.weakPoints[0] || 'core concepts'}" first.`,
          icon: '⚠️'
        });
        break; // Show only one blockage
      }
    }

    // Find next steps
    const learning = nodes.find((n: GraphNode) => n.confidence > 40 && n.confidence < 80);
    if (learning) {
      insights.push({
        type: 'suggestion',
        text: `Your ${learning.label} (${learning.confidence}%) is close to clear. One more session with practical numericals should lock it in.`,
        icon: '💡'
      });
    }

    return insights;
  }
}

export const KnowledgeGraphBuilder = new KnowledgeGraphBuilderService();
