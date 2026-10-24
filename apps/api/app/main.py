from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import User, current_user
from .config import get_settings
from .routers import collections, documents, graph_routes

settings = get_settings()

app = FastAPI(
    title="DocuPulse AI API",
    version="0.1.0",
    description="Doküman yükleme, GraphRAG sohbet ve bilgi grafiği API'si. Kimlik: Supabase JWT (Bearer).",
)
# CORS: only the web app's domains. // Faz B6
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://docupulse-web-[a-z0-9-]+\.vercel\.app" if settings.cors_origins else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(documents.router)
app.include_router(collections.router)
app.include_router(graph_routes.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/me", tags=["meta"])
def me(user: User = Depends(current_user)) -> dict[str, str | None]:
    return {"id": user.id, "email": user.email, "role": user.role}
