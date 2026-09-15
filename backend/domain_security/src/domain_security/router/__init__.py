"""App Router. Roda depois do App Security, sempre."""

from domain_security.router.dispatcher import Router
from domain_security.router.registry import ENTRY_POINT_GROUP, Registry

__all__ = ["ENTRY_POINT_GROUP", "Registry", "Router"]
