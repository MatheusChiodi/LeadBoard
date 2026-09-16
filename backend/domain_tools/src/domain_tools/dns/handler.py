"""Handler de TOOLS.DNS.

`async def`: toca rede via `HttpPort`, e o router o aguarda no proprio event
loop em vez de gastar uma thread do pool com uma chamada de I/O de rede.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from shared_contracts import domain_flag
from shared_contracts.tools import DnsQuery, DnsResponse

if TYPE_CHECKING:
    from domain_tools.dns.service import DnsService
    from shared_contracts import RequestContext


@domain_flag(domain="TOOLS", subdomain="DNS", payload=DnsQuery)
class DnsHandler:
    def __init__(self, service: DnsService) -> None:
        self._service = service

    async def handle(self, payload: DnsQuery, context: RequestContext) -> DnsResponse:
        return await self._service.lookup(payload)
