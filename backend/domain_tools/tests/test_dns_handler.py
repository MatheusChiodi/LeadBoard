"""Passo 5 da ordem da secao 8, para TOOLS.DNS."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from domain_tools.dns.handler import DnsHandler
from domain_tools.dns.service import DnsService
from shared_contracts import RequestContext
from shared_contracts.tools import DNS_RECORD_TYPES, DnsQuery


class HttpPortFake:
    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object:
        return {"Status": 0}


@pytest.fixture
def context() -> RequestContext:
    return RequestContext(request_id="req-1", received_at=datetime.now(UTC))


async def test_handler_devolve_o_dto_do_service(context: RequestContext) -> None:
    handler = DnsHandler(DnsService(HttpPortFake()))
    resposta = await handler.handle(DnsQuery(domain="exemplo.com"), context)
    assert resposta.__class__.__name__ == "DnsResponse"
    assert set(resposta.records) == set(DNS_RECORD_TYPES)
