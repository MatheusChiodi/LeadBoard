"""Entrada unica do LeadBoard. Conhece Flag, RequestContext e o router."""

from core_gateway.app import DISPATCH_PATH, FLAG_HEADER, HEALTH_PATH, create_app
from core_gateway.bootstrap import Settings, build_app
from core_gateway.bus import InProcessEventBus

__all__ = [
    "DISPATCH_PATH",
    "FLAG_HEADER",
    "HEALTH_PATH",
    "InProcessEventBus",
    "Settings",
    "build_app",
    "create_app",
]
