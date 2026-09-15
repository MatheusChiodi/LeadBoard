"""App Router: resolve destino, nunca autorizacao.

Sem cadeia de `if`, sem `match` sobre flags. Ele le o registry montado no boot, o
que torna dominio novo uma questao de pacote novo, sem tocar no core.
"""

from __future__ import annotations

import inspect
from typing import TYPE_CHECKING

import anyio.to_thread
from pydantic import BaseModel, ValidationError

from shared_contracts import ContractError, Flag, UnknownFlagError

if TYPE_CHECKING:
    from collections.abc import Mapping

    from domain_security.router.registry import Registry
    from shared_contracts import HandlerSpec, RequestContext


class Router:
    """Unico ponto do sistema que sabe que existem handlers sincronos e assincronos.

    A secao 5 exige que handler que toca disco seja `def`, executado no threadpool:
    `async def` com `open()` dentro trava o event loop e um `JOURNAL.ENTRY` lento
    congelaria o `TOOLS.CEP` de todo mundo. A secao 3 exige `await` no dispatch,
    porque `TOOLS.CEP` fala com a rede por `httpx.AsyncClient`.

    Conciliar isso num Protocol unico ou obrigaria I/O de rede a desperdicar uma
    thread, ou obrigaria I/O de disco a bloquear o loop. Entao a decisao vive aqui,
    e so aqui: quem escreve o handler usa a forma mais simples para o seu caso.
    """

    def __init__(self, registry: Registry) -> None:
        self._registry = registry

    async def dispatch(
        self,
        flag: Flag,
        raw_payload: Mapping[str, object],
        context: RequestContext,
    ) -> BaseModel:
        spec = self._registry.get(flag)
        if spec is None:
            raise UnknownFlagError(flag)

        payload = _validate(spec, raw_payload)
        handler = spec.factory()
        handle = getattr(handler, "handle", None)
        if handle is None:
            raise TypeError(f"Handler de {flag} nao implementa `handle`.")

        if inspect.iscoroutinefunction(handle):
            result = await handle(payload, context)
        else:
            result = await anyio.to_thread.run_sync(handle, payload, context)
        return _as_dto(flag, result)


def _as_dto(flag: Flag, result: object) -> BaseModel:
    """Garante que o handler devolveu DTO, e nao `dict` (principio 5).

    Sem esta checagem, um handler que devolvesse o documento cru do repository
    seria serializado sem reclamacao e o formato de armazenamento vazaria para o
    frontend — exatamente o acoplamento que o principio 5 existe para impedir.
    """
    if not isinstance(result, BaseModel):
        raise TypeError(
            f"Handler de {flag} devolveu {type(result).__name__}; era esperado um DTO Pydantic."
        )
    return result


def _validate(spec: HandlerSpec, raw_payload: Mapping[str, object]) -> BaseModel:
    """Aqui morre o `dict` que veio da rede.

    O principio 5 fala do dict que sai do arquivo, mas o dict que entra pelo HTTP
    tem o mesmo defeito: se ele chegar ao service, o formato de transporte amarra
    o sistema. O handler recebe DTO validado ou a request nunca chega nele.
    """
    try:
        return spec.payload_model.model_validate(dict(raw_payload))
    except ValidationError as exc:
        raise ContractError(f"Payload invalido para {spec.flag}: {exc.errors()}") from exc
