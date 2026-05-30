"""Loguru logging configuration."""
import sys
from pathlib import Path
from loguru import logger
from config import settings


def setup_logging():
    """Configure loguru with console + rotating file + JSONL sinks."""
    logger.remove()
    
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    
    logger.add(
        sys.stderr,
        level="INFO",
        colorize=True,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> | {message}",
    )
    
    logger.add(
        str(log_dir / "app.log"),
        level="DEBUG",
        rotation="10 MB",
        retention="7 days",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
    )
    
    logger.add(
        str(log_dir / "structured.jsonl"),
        level="INFO",
        serialize=True,
        rotation="10 MB",
        retention="30 days",
    )
    
    logger.info("Logging initialized")
    return logger
