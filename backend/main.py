"""FastAPI application entry point."""
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.sqlite import init_schema
from logging_config.loguru_setup import setup_logging
from audit.jsonl_writer import log_system_event
from plugins.registry import plugin_registry

# Initialize logging first
logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup
    logger.info("Starting CEQTSimple backend...")
    
    # Ensure data directories exist
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.audit_dir).mkdir(parents=True, exist_ok=True)
    
    # Auto-generate JWT secret if not provided
    if not settings.jwt_secret:
        settings.jwt_secret = uuid.uuid4().hex
        logger.warning("JWT_SECRET not set, generated random secret")
    
    # Initialize database
    init_schema()
    logger.info("Database initialized")
    
    # Activate plugins
    await plugin_registry.activate_all(app)
    
    log_system_event("INFO", "Backend started")
    logger.info("Backend ready on http://{}:{}", settings.host, settings.port)
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await plugin_registry.deactivate_all(app)
    log_system_event("INFO", "Backend stopped")
    logger.info("Backend stopped")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="CEQTSimple API",
        version="0.1.0",
        lifespan=lifespan,
    )
    
    # CORS — allow frontend from any origin in dev
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Auth router
    from routers.auth import router as auth_router
    app.include_router(auth_router)
    
    # Health check
    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "version": "0.1.0"}
    
    return app


# App instance for uvicorn
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
