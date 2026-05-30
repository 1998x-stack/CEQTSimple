"""Abstract base class for plugins."""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI


class AbstractPlugin(ABC):
    """All plugins must implement this interface."""
    
    name: str = "unnamed"
    version: str = "0.1.0"
    
    @abstractmethod
    async def on_startup(self, app: "FastAPI") -> None:
        """Called when FastAPI app starts."""
        ...
    
    @abstractmethod
    async def on_shutdown(self, app: "FastAPI") -> None:
        """Called when FastAPI app shuts down."""
        ...
