"""Boot da aplicacao: monta o contexto, descobre os dominios e cria o app.

Este arquivo e o unico do sistema que conhece variavel de ambiente. Configuracao
lida no meio do codigo e teste que depende de quem rodou.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import TYPE_CHECKING

from core_gateway.app import create_app
from core_gateway.bus import InProcessEventBus
from domain_security import AppSecurity, HttpClient, JwtTokenIssuer, Registry, Router

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI

DEFAULT_DATA_ROOT = Path("data")
DEFAULT_TOKEN_HOURS = 12


@dataclass(frozen=True, slots=True)
class Settings:
    data_root: Path
    jwt_secret: str
    token_ttl: timedelta
    http_timeout: float
    public_flags: frozenset[str] = field(default_factory=lambda: frozenset({"USER.LOGIN"}))

    @classmethod
    def from_env(cls) -> Settings:
        secret = os.environ.get("LEADBOARD_JWT_SECRET", "")
        if not secret:
            # Segredo com default embutido e segredo publicado: quem clona o repo
            # assina token valido. Recusar a subida e a unica opcao segura.
            raise RuntimeError(
                "LEADBOARD_JWT_SECRET nao definido. "
                'Gere com: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return cls(
            data_root=Path(os.environ.get("LEADBOARD_DATA_ROOT", str(DEFAULT_DATA_ROOT))),
            jwt_secret=secret,
            token_ttl=timedelta(
                hours=float(os.environ.get("LEADBOARD_TOKEN_HOURS", DEFAULT_TOKEN_HOURS))
            ),
            http_timeout=float(os.environ.get("LEADBOARD_HTTP_TIMEOUT", "5")),
        )


class NoPermissions:
    """Fonte de permissoes vazia.

    `USER.PERMISSIONS` e a fonte de verdade, e `domain_user` ainda nao existe.
    Ate la, toda identidade autenticada tem conjunto vazio — o que significa que
    qualquer flag registrada via `require_permission_for` sera negada, e nao
    liberada. Falhar fechado e o comportamento correto para o que falta.
    """

    def permissions_for(self, user_id: str) -> frozenset[str]:
        return frozenset()


@dataclass(frozen=True, slots=True)
class LeadBoardContext:
    """O que cada dominio recebe no boot. Satisfaz o Protocol `AppContext`."""

    data_root: Path
    events: InProcessEventBus
    http: HttpClient
    tokens: JwtTokenIssuer


def build_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or Settings.from_env()
    resolved.data_root.mkdir(parents=True, exist_ok=True)

    issuer = JwtTokenIssuer(secret=resolved.jwt_secret, ttl=resolved.token_ttl)
    context = LeadBoardContext(
        data_root=resolved.data_root,
        events=InProcessEventBus(),
        http=HttpClient(timeout=resolved.http_timeout),
        tokens=issuer,
    )

    # O registry e montado no boot e explode aqui se houver flag duplicada.
    # Descobrir isso na subida e o que evita descobrir em producao.
    registry = Registry.discover(context)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # O pool de conexoes do httpx so existe se o cliente sobreviver entre
        # requests; fecha-lo no shutdown e o que evita socket pendurado ao parar.
        yield
        await context.http.aclose()

    return create_app(
        router=Router(registry=registry),
        security=AppSecurity(
            issuer=issuer,
            permissions=NoPermissions(),
            public_flags=resolved.public_flags,
        ),
        lifespan=lifespan,
    )
