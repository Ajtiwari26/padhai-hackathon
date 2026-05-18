import AsyncStorage from '@react-native-async-storage/async-storage';

const NODES_KEY = 'padh-graph-nodes';
const EDGES_KEY = 'padh-graph-edges';

export interface GraphNode {
  id: string;
  label: string;
  subject: string;
  x: number; // 0 to 1 relative coordinate
  y: number; // 0 to 1 relative coordinate
  size: number;
  confidence: number;
  weakPoints: string[];
  lastPhase: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related';
}

// Removed hardcoded default nodes and edges. 
// We now return an empty graph if the student hasn't started learning.

// In-memory cache to allow synchronous getGraph() reads
let cachedNodes: GraphNode[] | null = null;
let cachedEdges: GraphEdge[] | null = null;

class KnowledgeGraphBuilderService {
  /**
   * Initialize cache from AsyncStorage. Call this once at startup.
   */
  public async init(): Promise<void> {
    try {
      const [nodesStr, edgesStr] = await Promise.all([
        AsyncStorage.getItem(NODES_KEY),
        AsyncStorage.getItem(EDGES_KEY),
      ]);
      cachedNodes = nodesStr ? JSON.parse(nodesStr) : [];
      cachedEdges = edgesStr ? JSON.parse(edgesStr) : [];
    } catch (e) {
      console.error('[KnowledgeGraphBuilder] Failed to load from storage:', e);
      cachedNodes = [];
      cachedEdges = [];
    }
  }

  /**
   * Fetches the student's current knowledge DAG (Directed Acyclic Graph).
   */
  public getGraph(): { nodes: GraphNode[], edges: GraphEdge[] } {
    return { 
      nodes: cachedNodes || [], 
      edges: cachedEdges || [] 
    };
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
      cachedNodes = nodes;
      // Fire-and-forget async persist
      AsyncStorage.setItem(NODES_KEY, JSON.stringify(nodes)).catch(e =>
        console.error('[KnowledgeGraphBuilder] Failed to persist nodes:', e)
      );
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
