"""Handler de TOOLS.CEP.

Ele valida o contrato de entrada (o Pydantic ja fez isso no `CepQuery`) e
delega. `async def`: toca rede via `HttpPort`, e o router o aguarda no proprio
event loop em vez de gastar uma thread do pool com uma chamada de I/O de rede.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from shared_contracts import domain_flag
from shared_contracts.tools import CepQuery, CepResponse

if TYPE_CHECKING:
    from domain_tools.cep.service import CepService
    from shared_contracts import RequestContext


@domain_flag(domain="TOOLS", subdomain="CEP", payload=CepQuery)
class CepHandler:
    def __init__(self, service: CepService) -> None:
        self._service = service

    async def handle(self, payload: CepQuery, context: RequestContext) -> CepResponse:
        return await self._service.lookup(payload)
