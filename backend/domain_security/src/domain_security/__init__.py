"""Dominio Security: intermedia toda request antes de qualquer regra de negocio.

Ordem obrigatoria: App Security resolve identidade e permissao; so depois o App
Router resolve destino. O Http Client e a unica saida para a rede.
"""

from domain_security.httpclient import HttpClient, HttpClientError
from domain_security.router import Registry, Router
from domain_security.security import AppSecurity, JwtTokenIssuer, PermissionSource

__all__ = [
    "AppSecurity",
    "HttpClient",
    "HttpClientError",
    "JwtTokenIssuer",
    "PermissionSource",
    "Registry",
    "Router",
]
