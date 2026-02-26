from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from api.routes.chat import router as chat_router
from api.routes.steps import router as steps_router
from api.routes.llm_history import router as llm_history_router
from utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="StyleCue API",
    description="AI-powered personal styling assistant",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS origins configured: %s", settings.cors_origins)

app.include_router(chat_router, prefix="/api")
app.include_router(steps_router, prefix="/api")
app.include_router(llm_history_router, prefix="/api")

# Serve uploaded images as static files at /uploads/{slug}
_uploads_path = Path(settings.uploads_dir)
_uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_path)), name="uploads")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
