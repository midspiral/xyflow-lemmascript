import { useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  wouldCreateCycle,
  MarkerType,
  type Node,
  type Edge,
  type OnConnect,
  type IsValidConnection,
  type DefaultEdgeOptions,
} from '@xyflow/react';

// Arrowheads so edge *direction* is visible — a default node's source handle is the
// bottom and its target is the top, so the edge points bottom -> top regardless of
// which way you dragged. Direction is what determines a cycle.
const edgeOptions: DefaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed } };

// Plain `default` nodes already have a target handle (top) and a source handle
// (bottom), so you can drag bottom -> top to build edges and close loops.
const initialNodes: Node[] = [
  { id: 'A', position: { x: 250, y: 0 }, data: { label: 'A' } },
  { id: 'B', position: { x: 150, y: 130 }, data: { label: 'B' } },
  { id: 'C', position: { x: 350, y: 130 }, data: { label: 'C' } },
  { id: 'D', position: { x: 250, y: 260 }, data: { label: 'D' } },
];

// Seeded DAG: A -> B -> D. Now drag D's bottom handle up to A's top handle and watch
// the connection turn red and get refused (it would close A -> B -> D -> A).
const initialEdges: Edge[] = [
  { id: 'a-b', source: 'A', target: 'B', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'b-d', source: 'B', target: 'D', markerEnd: { type: MarkerType.ArrowClosed } },
];

const CycleGateFlow = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  // Read the LIVE edges from the store, never a captured `edges` closure — so the gate
  // is correct even while you build the graph up edge by edge.
  const { getEdges } = useReactFlow();

  // Verified gate (proven sound + complete in packages/system/src/utils/graph.ts).
  // Live drag feedback: the connection line turns red/dashed while it would close a loop.
  const isValidConnection: IsValidConnection = useCallback(
    (c) => c.source != null && c.target != null && !wouldCreateCycle(getEdges(), c.source, c.target),
    [getEdges]
  );

  // The guarantee lives at the commit: gate onConnect against the live edges so the
  // graph provably stays acyclic across the whole session. addEdge is verified too.
  const onConnect: OnConnect = useCallback(
    (params) => {
      if (params.source != null && params.target != null && !wouldCreateCycle(getEdges(), params.source, params.target)) {
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [getEdges, setEdges]
  );

  return (
    <>
      {/* Make a cycle-creating drag obviously rejected: React Flow tags the in-progress
          connection line `.invalid` (via isValidConnection), but doesn't style it. */}
      <style>{`
        .react-flow__connection.invalid .react-flow__connection-path {
          stroke: #e74c3c;
          stroke-width: 2;
          stroke-dasharray: 6 4;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={edgeOptions}
        fitView
      >
        <Background />
        <Controls />
        <Panel position="top-left">
          <div
            style={{
              background: 'white',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              maxWidth: 300,
              lineHeight: 1.4,
              boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
            }}
          >
            <strong>Verified acyclic gate</strong>
            <div style={{ marginTop: 6, color: '#555' }}>
              Drag from a node&apos;s <em>bottom</em> handle to another node&apos;s <em>top</em> handle.
              A connection that would create a cycle (or a self-loop) turns{' '}
              <span style={{ color: '#e74c3c', fontWeight: 600 }}>red &amp; dashed</span> and is refused —
              proven in <code>graph.ts</code>.
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </>
  );
};

// useReactFlow() requires the provider; CycleGateFlow renders <ReactFlow>, so it must
// sit inside <ReactFlowProvider>.
const CycleGate = () => (
  <ReactFlowProvider>
    <CycleGateFlow />
  </ReactFlowProvider>
);

export default CycleGate;
