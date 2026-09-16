"""Teste de integracao das flags TOOLS.CEP, TOOLS.DNS e TOOLS.IP.

Passo 7 da ordem de escrita da secao 8: a request com X-Domain-Flag chega ao
destino de verdade, passando pelo router assincrono. Usa ASGITransport contra o
app em memoria, sem subir servidor e sem tocar rede — a porta HTTP e falsa.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient

from core_gateway import create_app
from core_gateway.bus import InProcessEventBus
from domain_security import AppSecurity, JwtTokenIssuer, Registry, Router
from domain_tools.registry import handlers
from shared_contracts.tools import DNS_RECORD_TYPES

if TYPE_CHECKING:
    from pathlib import Path

SECRET = "segredo-de-teste-com-mais-de-32-bytes-para-o-tools"

_VIACEP_OK = {
    "cep": "01001-000",
    "logradouro": "Praca da Se",
    "bairro": "Se",
    "localidade": "Sao Paulo",
    "uf": "SP",
    "ddd": "11",
}


class HttpPortFake:
    """Uma resposta por host, o suficiente para as tres ferramentas."""

    def __init__(self) -> None:
        self.urls: list[str] = []

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object:
        self.urls.append(url)
        if "viacep.com.br" in url:
            return dict(_VIACEP_OK) if "01001000" in url else {"erro": True}
        if "dns.google" in url:
            return {"Status": 0}
        if "ipwho.is" in url:
            return {
                "success": True,
                "ip": "8.8.8.8",
                "country": "United States",
                "region": "",
                "city": "",
                "latitude": 0.0,
                "longitude": 0.0,
                "asn": 15169,
                "org": "Google LLC",
            }
        raise AssertionError(f"URL inesperada: {url}")


class ContextoDeTeste:
    """Satisfaz o AppContext com http falso; tokens e disco nao entram na jogada."""

    def __init__(self, data_root: Path) -> None:
        self.data_root = data_root
        self.events = InProcessEventBus()
        self.http = HttpPortFake()
        self.tokens = None


@pytest.fixture
def contexto(tmp_path: Path) -> ContextoDeTeste:
    return ContextoDeTeste(tmp_path)


@pytest.fixture
def issuer() -> JwtTokenIssuer:
    return JwtTokenIssuer(secret=SECRET, ttl=timedelta(hours=1))


@pytest.fixture
def client(contexto: ContextoDeTeste, issuer: JwtTokenIssuer) -> AsyncClient:
    app = create_app(
        router=Router(registry=Registry.from_specs(handlers(contexto))),  # type: ignore[arg-type]
        security=AppSecurity(issuer=issuer, permissions=_SemPermissoes()),
    )
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


class _SemPermissoes:
    def permissions_for(self, user_id: str) -> frozenset[str]:
        return frozenset()


def _headers(issuer: JwtTokenIssuer) -> dict[str, str]:
    return {"Authorization": f"Bearer {issuer.issue('u1', frozenset())}"}


async def test_a_flag_cep_chega_ao_handler(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers={**_headers(issuer), "X-Domain-Flag": "TOOLS.CEP"},
            json={"cep": "01001-000"},
        )
    assert response.status_code == 200
    assert response.json()["uf"] == "SP"


async def test_a_flag_dns_chega_ao_handler(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers={**_headers(issuer), "X-Domain-Flag": "TOOLS.DNS"},
            json={"domain": "exemplo.com"},
        )
    assert response.status_code == 200
    assert set(response.json()["records"]) == set(DNS_RECORD_TYPES)


async def test_a_flag_ip_chega_ao_handler(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers={**_headers(issuer), "X-Domain-Flag": "TOOLS.IP"},
            json={"ip": "8.8.8.8"},
        )
    assert response.status_code == 200
    assert response.json()["org"] == "Google LLC"


async def test_cep_inexistente_devolve_404_pelo_gateway(
    client: AsyncClient, issuer: JwtTokenIssuer
) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers={**_headers(issuer), "X-Domain-Flag": "TOOLS.CEP"},
            json={"cep": "00000000"},
        )
    assert response.status_code == 404


async def test_cep_mal_formado_e_erro_de_contrato(
    client: AsyncClient, issuer: JwtTokenIssuer
) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers={**_headers(issuer), "X-Domain-Flag": "TOOLS.CEP"},
            json={"cep": "123"},
        )
    assert response.status_code == 422
