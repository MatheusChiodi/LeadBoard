"""Portas que o nucleo oferece aos dominios.

Sao Protocol, nunca implementacao: e o que permite `domain_user` pedir a emissao
de um token sem importar `domain_security`, e `domain_journal` publicar um evento
sem conhecer quem entrega.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from pathlib import Path

    from shared_contracts.events import DomainEvent


@runtime_checkable
class EventBus(Protocol):
    """Publicacao de evento. O publicador nunca sabe quem assina."""

    def publish(self, event: DomainEvent) -> None: ...


@runtime_checkable
class TokenIssuer(Protocol):
    """Fecha o furo do fluxo 7.1: o service de login PEDE o token, nao o assina.

    Implementado pelo App Security; consumido por `domain_user` sem import.
    """

    def issue(self, user_id: str, permissions: frozenset[str]) -> str: ...

    def verify(self, token: str) -> tuple[str, frozenset[str]]: ...


@runtime_checkable
class HttpPort(Protocol):
    """Unica saida para a rede. Timeout, retry e chave de API vivem do outro lado."""

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object: ...


@runtime_checkable
class Clock(Protocol):
    """Injetar o relogio e o que torna teste de periodo deterministico."""

    def now(self) -> object: ...


class AppContext(Protocol):
    """O que o boot entrega a cada factory de handler.

    Evita singleton global e mantem o handler testavel com portas falsas.
    """

    @property
    def data_root(self) -> Path: ...

    @property
    def events(self) -> EventBus: ...

    @property
    def http(self) -> HttpPort: ...

    @property
    def tokens(self) -> TokenIssuer: ...
