"""Passo 1 da ordem da secao 8, para TOOLS.IP."""

from __future__ import annotations

import pytest

from domain_tools.ip.service import IpService
from shared_contracts import NotFoundError
from shared_contracts.tools import IpQuery


class HttpPortFake:
    def __init__(self, response: object) -> None:
        self._response = response
        self.urls: list[str] = []

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object:
        self.urls.append(url)
        return self._response


async def test_ip_valido_devolve_localizacao() -> None:
    http = HttpPortFake(
        {
            "success": True,
            "ip": "8.8.8.8",
            "country": "United States",
            "region": "California",
            "city": "Mountain View",
            "latitude": 37.42,
            "longitude": -122.08,
            "asn": 15169,
            "org": "Google LLC",
        }
    )
    resposta = await IpService(http).locate(IpQuery(ip="8.8.8.8"))
    assert resposta.country == "United States"
    assert resposta.asn == 15169
    assert resposta.org == "Google LLC"


async def test_ip_aceita_dados_aninhados_em_connection() -> None:
    """Formato real do ipwho.is: asn/org vivem em `connection`, nao no topo."""
    http = HttpPortFake(
        {
            "success": True,
            "ip": "1.1.1.1",
            "country": "Australia",
            "region": "Queensland",
            "city": "Brisbane",
            "latitude": -27.47,
            "longitude": 153.02,
            "connection": {"asn": 13335, "org": "Cloudflare, Inc."},
        }
    )
    resposta = await IpService(http).locate(IpQuery(ip="1.1.1.1"))
    assert resposta.asn == 13335
    assert resposta.org == "Cloudflare, Inc."


async def test_ip_vazio_consulta_o_endpoint_sem_segmento() -> None:
    http = HttpPortFake({"success": True, "ip": "203.0.113.9", "country": "", "region": "",
                          "city": "", "latitude": 0.0, "longitude": 0.0, "asn": None, "org": ""})
    await IpService(http).locate(IpQuery())
    assert http.urls == ["https://ipwho.is/"]


async def test_falha_do_provedor_e_not_found() -> None:
    http = HttpPortFake({"success": False, "message": "invalid IP address"})
    with pytest.raises(NotFoundError):
        await IpService(http).locate(IpQuery(ip="9.9.9.9"))
