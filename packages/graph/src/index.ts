export type {
  Graph,
  GraphNode,
  GraphEdge,
  Transition,
  StateMachineDefinition,
  StateMachineInstance,
  VerificationResult,
} from "./types.js";

export {
  createDigraph,
  createGraph,
  neighbors,
  inEdges,
  outEdges,
  degree,
  inDegree,
  outDegree,
  adjacencyList,
  addNode,
  addEdge,
  removeNode,
  removeEdge,
} from "./graph.js";

export {
  topoSort,
  detectCycles,
  hasCycles,
  bfs,
  dfs,
  reachable,
  hasPath,
  shortestPath,
  dijkstra,
  stronglyConnectedComponents,
  isDAG,
  transitiveClosure,
  reverseGraph,
} from "./algorithms.js";

export {
  defineStateMachine,
  verify,
  createInstance,
  toGraph,
  reachableStates,
  deadEndStates,
  isNondeterministic,
} from "./state-machine.js";

export { parseDigraph, parseStateMachine } from "./dsl.js";

export { digraph, graph, stateMachine } from "./macros.js";
