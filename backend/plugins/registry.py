"""Plugin registry for discovering and managing plugins."""
from typing import TYPE_CHECKING
from loguru import logger

if TYPE_CHECKING:
    from fastapi import FastAPI
    from plugins.base import AbstractPlugin


class PluginRegistry:
    """Manages plugin lifecycle."""
    
    def __init__(self):
        self._plugins: dict[str, "AbstractPlugin"] = {}
    
    def register(self, plugin: "AbstractPlugin") -> None:
        if plugin.name in self._plugins:
            logger.warning(f"Plugin '{plugin.name}' already registered, overwriting")
        self._plugins[plugin.name] = plugin
        logger.info(f"Plugin registered: {plugin.name} v{plugin.version}")
    
    def get(self, name: str) -> "AbstractPlugin | None":
        return self._plugins.get(name)
    
    def list_plugins(self) -> list[str]:
        return list(self._plugins.keys())
    
    async def activate_all(self, app: "FastAPI") -> None:
        for name, plugin in self._plugins.items():
            logger.info(f"Activating plugin: {name}")
            await plugin.on_startup(app)
    
    async def deactivate_all(self, app: "FastAPI") -> None:
        for name, plugin in self._plugins.items():
            logger.info(f"Deactivating plugin: {name}")
            await plugin.on_shutdown(app)


plugin_registry = PluginRegistry()
