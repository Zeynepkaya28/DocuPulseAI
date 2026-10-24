// AUTO-GENERATED from packages/contracts/schemas/contracts.json — do not edit by hand.

export const JOB_STAGES = ["Yükleniyor","Parçalara bölünüyor","Embedding","Varlıklar çıkarılıyor","Grafa yazılıyor"] as const;
export const QUEUES = ["document_ingest","chunk_embed","chunk_extract","graph_write"] as const;
export const ACCEPTED_MIME = ["application/pdf","text/markdown","text/csv","text/plain"] as const;
export const ACCEPTED_EXT = [".pdf",".md",".markdown",".csv",".txt"] as const;

export type Role = "admin" | "editor" | "viewer";
export const RoleValues = ["admin","editor","viewer"] as const;

export type DocumentStatus = "pending" | "uploaded" | "processing" | "ready" | "failed" | "canceled";
export const DocumentStatusValues = ["pending","uploaded","processing","ready","failed","canceled"] as const;

export type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";
export const JobStatusValues = ["queued","running","done","failed","canceled"] as const;

export type EntityType = "person" | "organization" | "concept" | "product" | "event" | "document";
export const EntityTypeValues = ["person","organization","concept","product","event","document"] as const;

export type SearchScope = "all" | "documents" | "entities" | "passages";
export const SearchScopeValues = ["all","documents","entities","passages"] as const;

export interface Document {
  id: string;
  owner: string;
  collection_id?: string | null;
  title: string;
  author?: string | null;
  published_at?: string | null;
  mime: string;
  size_bytes?: number | null;
  storage_path?: string | null;
  status: DocumentStatus;
  summary?: string | null;
  entity_count?: number;
  created_at: string;
}

export interface Job {
  id: string;
  document_id: string;
  stage: number;
  stage_name: string;
  progress: number;
  total?: number | null;
  status: JobStatus;
  error?: string | null;
  updated_at: string;
}

export interface Collection {
  id: string;
  name: string;
  owner?: string;
}

export interface UploadUrlRequest {
  filename: string;
  mime: string;
  size_bytes: number;
  collection_id?: string | null;
}

export interface UploadUrlResponse {
  document_id: string;
  bucket: string;
  storage_path: string;
  signed_url: string;
  token: string;
}

export interface DocumentUploadedEvent {
  document_id: string;
  owner_id: string;
  storage_path: string;
  mime: string;
  page_from?: number | null;
  page_to?: number | null;
}

export interface ChunkBatchMessage {
  document_id: string;
  chunk_ids: string[];
}

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  aliases?: string[];
}

export interface ExtractedRelation {
  source: string;
  target: string;
  type: string;
  evidence_chunk_id: string;
}

export interface GraphWriteMessage {
  document_id: string;
  chunk_ids: string[];
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

export interface Passage {
  chunk_id: string;
  document_id: string;
  document_title: string;
  page?: number | null;
  snippet: string;
  score: number;
}

export interface PathEdge {
  source: string;
  target: string;
  type: string;
  document_id?: string | null;
  chunk_id?: string | null;
}

export interface RelationPath {
  nodes: GraphNode[];
  edges: PathEdge[];
}

export interface Conflict {
  subject: string;
  relation: string;
  values: string[];
  document_ids?: string[];
}

export interface ChatRequest {
  question: string;
  session_id?: string | null;
  collection_id?: string | null;
}

export interface ChatStatusEvent {
  type: "status";
  stage: "searching_graph" | "searching_passages" | "writing";
  session_id?: string | null;
}

export interface ChatTokenEvent {
  type: "token";
  text: string;
}

export interface ChatSourcesEvent {
  type: "sources";
  passages: Passage[];
  paths: RelationPath[];
  conflicts: Conflict[];
}

export interface ChatDoneEvent {
  type: "done";
  message_id: string;
}

export interface ChatErrorEvent {
  type: "error";
  message: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  degree?: number;
  document_ids?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  conflict?: boolean;
  document_id?: string | null;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated?: boolean;
}

export interface SearchHit {
  kind: "document" | "entity" | "passage";
  id: string;
  title: string;
  subtitle?: string | null;
  document_id?: string | null;
  score: number;
}

export type ChatEvent = ChatStatusEvent | ChatTokenEvent | ChatSourcesEvent | ChatDoneEvent | ChatErrorEvent;
