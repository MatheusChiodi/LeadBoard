"""Passo 5 da ordem da secao 8, para TOOLS.IP."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from domain_tools.ip.handler import IpHandler
from domain_tools.ip.service import IpService
from shared_contracts import RequestContext
from shared_contracts.tools import IpQuery


class HttpPortFake:
    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object:
        return {"success": True, "ip": "8.8.8.8", "country": "United States", "region": "",
                "city": "", "latitude": 0.0, "longitude": 0.0, "asn": None, "org": ""}


@pytest.fixture
def context() -> RequestContext:
    return RequestContext(request_id="req-1", received_at=datetime.now(UTC))


async def test_handler_devolve_o_dto_do_service(context: RequestContext) -> None:
    handler = IpHandler(IpService(HttpPortFake()))
    resposta = await handler.handle(IpQuery(ip="8.8.8.8"), context)
    assert resposta.__class__.__name__ == "IpResponse"
    assert resposta.country == "United States"
