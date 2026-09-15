"""Contrato do handler e o decorador que anuncia a flag.

Por que DOIS protocolos em vez de um:
`JOURNAL.ENTRY` toca disco e, pela secao 5, precisa ser `def` para o FastAPI
executa-lo no threadpool. `TOOLS.CEP` fala com a rede via httpx e precisa ser
`async def`. Forcar um unico formato ou trava o event loop ou joga I/O de rede
no threadpool. Quem concilia os dois e o router — e so ele.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol, TypeVar

from pydantic import BaseModel

from shared_contracts.flag import Flag

if TYPE_CHECKING:
    from shared_contracts.context import RequestContext

TIn = TypeVar("TIn", contravariant=True)
TOut = TypeVar("TOut", covariant=True)


class SyncDomainHandler(Protocol[TIn, TOut]):
    """Handler que toca disco. O router o executa em thread separada."""

    def handle(self, payload: TIn, context: RequestContext) -> TOut: ...


class AsyncDomainHandler(Protocol[TIn, TOut]):
    """Handler que toca rede. O router o aguarda no proprio event loop."""

    async def handle(self, payload: TIn, context: RequestContext) -> TOut: ...


DomainHandler = SyncDomainHandler[TIn, TOut] | AsyncDomainHandler[TIn, TOut]
HandlerFactory = Callable[[], object]

_SPEC_ATTR = "__leadboard_spec__"


@dataclass(frozen=True, slots=True)
class HandlerSpec:
    """O que o registry precisa saber sobre um handler sem instancia-lo.

    `payload_model` e o que faz o dict cru do HTTP morrer no router: o handler
    recebe DTO validado, nunca `dict` (principio 5).

    A `factory` ja chega ligada as dependencias. Quem as liga e a funcao de
    registro do dominio, que recebe o `AppContext` uma unica vez no boot — assim o
    router nunca precisa saber o que um handler consome para ser construido.
    """

    flag: Flag
    payload_model: type[BaseModel]
    factory: HandlerFactory


def domain_flag(*, domain: str, subdomain: str, payload: type[BaseModel]) -> Callable[[type], type]:
    """Anuncia a flag atendida por um handler e o DTO que ele aceita."""

    def decorate(cls: type) -> type:
        flag = Flag.parse(f"{domain}.{subdomain}")
        setattr(cls, _SPEC_ATTR, (flag, payload))
        return cls

    return decorate


def spec_of(cls: type, factory: HandlerFactory) -> HandlerSpec:
    """Le a marca deixada pelo decorador e amarra a factory de construcao."""
    marker = getattr(cls, _SPEC_ATTR, None)
    if marker is None:
        raise TypeError(f"{cls.__name__} nao foi decorado com @domain_flag.")
    flag, payload_model = marker
    return HandlerSpec(flag=flag, payload_model=payload_model, factory=factory)
