/**
 * Agent Mesh Protocol — Public API
 * Nexus AI v2.0
 */
export { meshBus } from "./bus";
export { meshRouter } from "./router";
export {
  handshake,
  initializeMesh,
  createRequest,
  createResponse,
  serializeMessage,
  deserializeMessage,
} from "./protocol";
export type {
  MeshAgent,
  MeshMessage,
  MeshEvent,
  MeshRoute,
  MeshTopology,
  AgentStatus,
  AgentCapability,
  MeshEventHandler,
  MeshMessageHandler,
} from "./types";
