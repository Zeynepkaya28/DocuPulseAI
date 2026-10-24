"""AUTO-GENERATED from packages/contracts/schemas/contracts.json — do not edit by hand."""
from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field

JOB_STAGES: tuple[str, ...] = ("Yükleniyor","Parçalara bölünüyor","Embedding","Varlıklar çıkarılıyor","Grafa yazılıyor",)
QUEUES: tuple[str, ...] = ("document_ingest","chunk_embed","chunk_extract","graph_write",)
ACCEPTED_MIME: tuple[str, ...] = ("application/pdf","text/markdown","text/csv","text/plain",)
ACCEPTED_EXT: tuple[str, ...] = (".pdf",".md",".markdown",".csv",".txt",)

Role = Literal["admin", "editor", "viewer"]

DocumentStatus = Literal["pending", "uploaded", "processing", "ready", "failed", "canceled"]

JobStatus = Literal["queued", "running", "done", "failed", "canceled"]

EntityType = Literal["person", "organization", "concept", "product", "event", "document"]

SearchScope = Literal["all", "documents", "entities", "passages"]


class Document(BaseModel):
    id: str
    owner: str
    collection_id: str | None = None
    title: str
    author: str | None = None
    published_at: str | None = None
    mime: str
    size_bytes: int | None = None
    storage_path: str | None = None
    status: DocumentStatus
    summary: str | None = None
    entity_count: int = 0
    created_at: str


class Job(BaseModel):
    id: str
    document_id: str
    stage: int
    stage_name: str
    progress: int
    total: int | None = None
    status: JobStatus
    error: str | None = None
    updated_at: str


class Collection(BaseModel):
    id: str
    name: str
    owner: str | None = None


class UploadUrlRequest(BaseModel):
    filename: str
    mime: str
    size_bytes: int
    collection_id: str | None = None


class UploadUrlResponse(BaseModel):
    document_id: str
    bucket: str
    storage_path: str
    signed_url: str
    token: str


class DocumentUploadedEvent(BaseModel):
    document_id: str
    owner_id: str
    storage_path: str
    mime: str
    page_from: int | None = None
    page_to: int | None = None


class ChunkBatchMessage(BaseModel):
    document_id: str
    chunk_ids: list[str]


class ExtractedEntity(BaseModel):
    name: str
    type: EntityType
    aliases: list[str] = Field(default_factory=list)


class ExtractedRelation(BaseModel):
    source: str
    target: str
    type: str
    evidence_chunk_id: str


class GraphWriteMessage(BaseModel):
    document_id: str
    chunk_ids: list[str]
    entities: list[ExtractedEntity]
    relations: list[ExtractedRelation]


class Passage(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    page: int | None = None
    snippet: str
    score: float


class PathEdge(BaseModel):
    source: str
    target: str
    type: str
    document_id: str | None = None
    chunk_id: str | None = None


class RelationPath(BaseModel):
    nodes: list[GraphNode]
    edges: list[PathEdge]


class Conflict(BaseModel):
    subject: str
    relation: str
    values: list[str]
    document_ids: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str
    session_id: str | None = None
    collection_id: str | None = None


class ChatStatusEvent(BaseModel):
    type: Literal["status"] = "status"
    stage: Literal["searching_graph", "searching_passages", "writing"]
    session_id: str | None = None


class ChatTokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class ChatSourcesEvent(BaseModel):
    type: Literal["sources"] = "sources"
    passages: list[Passage]
    paths: list[RelationPath]
    conflicts: list[Conflict]


class ChatDoneEvent(BaseModel):
    type: Literal["done"] = "done"
    message_id: str


class ChatErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


class GraphNode(BaseModel):
    id: str
    name: str
    type: EntityType
    degree: int = 0
    document_ids: list[str] = Field(default_factory=list)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    conflict: bool = False
    document_id: str | None = None


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    truncated: bool = False


class SearchHit(BaseModel):
    kind: Literal["document", "entity", "passage"]
    id: str
    title: str
    subtitle: str | None = None
    document_id: str | None = None
    score: float


ChatEvent = Annotated[Union[ChatStatusEvent, ChatTokenEvent, ChatSourcesEvent, ChatDoneEvent, ChatErrorEvent], Field(discriminator="type")]

Document.model_rebuild()
Job.model_rebuild()
Collection.model_rebuild()
UploadUrlRequest.model_rebuild()
UploadUrlResponse.model_rebuild()
DocumentUploadedEvent.model_rebuild()
ChunkBatchMessage.model_rebuild()
ExtractedEntity.model_rebuild()
ExtractedRelation.model_rebuild()
GraphWriteMessage.model_rebuild()
Passage.model_rebuild()
PathEdge.model_rebuild()
RelationPath.model_rebuild()
Conflict.model_rebuild()
ChatRequest.model_rebuild()
ChatStatusEvent.model_rebuild()
ChatTokenEvent.model_rebuild()
ChatSourcesEvent.model_rebuild()
ChatDoneEvent.model_rebuild()
ChatErrorEvent.model_rebuild()
GraphNode.model_rebuild()
GraphEdge.model_rebuild()
GraphResponse.model_rebuild()
SearchHit.model_rebuild()
