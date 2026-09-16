"""Handler de TOOLS.IP.

`async def`: toca rede via `HttpPort`, e o router o aguarda no proprio event
loop em vez de gastar uma thread do pool com uma chamada de I/O de rede.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from shared_contracts import domain_flag
from shared_contracts.tools import IpQuery, IpResponse

if TYPE_CHECKING:
    from domain_tools.ip.service import IpService
    from shared_contracts import RequestContext


@domain_flag(domain="TOOLS", subdomain="IP", payload=IpQuery)
class IpHandler:
    def __init__(self, service: IpService) -> None:
        self._service = service

    async def handle(self, payload: IpQuery, context: RequestContext) -> IpResponse:
        return await self._service.locate(payload)
