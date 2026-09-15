"""Teste de integracao da flag JOURNAL.ENTRY.

Passo 7 da ordem de escrita da secao 8: a request com X-Domain-Flag chega ao
destino. Usa ASGITransport contra o app em memoria, sem subir servidor.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient

from core_gateway import create_app
from core_gateway.bus import InProcessEventBus
from domain_journal.registry import handlers
from domain_security import AppSecurity, JwtTokenIssuer, Registry, Router

if TYPE_CHECKING:
    from pathlib import Path

SECRET = "segredo-de-teste-com-mais-de-32-bytes-para-o-journal"


class ContextoDeTeste:
    """Satisfaz o AppContext sem HttpClient nem TokenIssuer reais.

    `entry` nao fala com a rede nem emite token; exigir esses objetos so para
    montar o registry seria acoplar o teste ao que o micro-dominio nao usa.
    """

    def __init__(self, data_root: Path) -> None:
        self.data_root = data_root
        self.events = InProcessEventBus()
        self.http = None
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
    return {
        "X-Domain-Flag": "JOURNAL.ENTRY",
        "Authorization": f"Bearer {issuer.issue('u1', frozenset())}",
    }


async def test_a_flag_chega_ao_handler(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={"op": "create", "title": "primeiro registro", "occurred_on": "2026-09-15"},
        )
    assert response.status_code == 200
    assert response.json()["title"] == "primeiro registro"
    assert response.json()["visibility"] == "PRIVATE"


async def test_ciclo_completo_pelo_gateway(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        criada = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={"op": "create", "title": "entrega da sprint", "occurred_on": "2026-09-15"},
        )
        entry = criada.json()

        promovida = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={
                "op": "promote",
                "entry_id": entry["id"],
                "expected_version": entry["version"],
                "visibility": "REPORTABLE",
            },
        )

        reportaveis = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={
                "op": "list",
                "start": "2026-09-01",
                "end": "2026-09-30",
                "only_reportable": True,
            },
        )

    assert promovida.json()["visibility"] == "REPORTABLE"
    assert reportaveis.json()["total"] == 1


async def test_entrada_privada_nao_aparece_na_listagem_reportavel(
    client: AsyncClient, issuer: JwtTokenIssuer
) -> None:
    """A garantia da secao 4, verificada de ponta a ponta pela borda HTTP."""
    async with client:
        await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={
                "op": "create",
                "title": "alguem entregou tarde de novo",
                "occurred_on": "2026-09-15",
            },
        )
        resposta = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={
                "op": "list",
                "start": "2026-09-01",
                "end": "2026-09-30",
                "only_reportable": True,
            },
        )
    assert resposta.json()["total"] == 0
    assert "entregou tarde" not in resposta.text


async def test_operacao_desconhecida_e_erro_de_contrato(
    client: AsyncClient, issuer: JwtTokenIssuer
) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch", headers=_headers(issuer), json={"op": "explodir"}
        )
    assert response.status_code == 422


async def test_versao_divergente_devolve_409(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        criada = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={"op": "create", "title": "x", "occurred_on": "2026-09-15"},
        )
        conflito = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={
                "op": "update",
                "entry_id": criada.json()["id"],
                "expected_version": 99,
                "title": "y",
            },
        )
    assert conflito.status_code == 409


async def test_entrada_inexistente_devolve_404(client: AsyncClient, issuer: JwtTokenIssuer) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={"op": "get", "entry_id": "fantasma"},
        )
    assert response.status_code == 404


async def test_evento_de_outro_dominio_vira_rascunho_visivel_pela_flag(
    client: AsyncClient, issuer: JwtTokenIssuer, contexto: ContextoDeTeste
) -> None:
    """Fluxo 7.5: focus publica, journal assina, sem um import entre eles."""
    from datetime import UTC, datetime

    from shared_contracts import TaskCompleted

    contexto.events.publish(
        TaskCompleted(
            event_id="evento-1",
            occurred_at=datetime(2026, 9, 15, tzinfo=UTC),
            user_id="u1",
            task_id="t1",
            title="subir o gateway",
        )
    )

    async with client:
        resposta = await client.post(
            "/api/dispatch",
            headers=_headers(issuer),
            json={"op": "list", "start": "2026-09-01", "end": "2026-09-30"},
        )

    (entrada,) = resposta.json()["entries"]
    assert entrada["status"] == "DRAFT"
    assert entrada["visibility"] == "PRIVATE"
    assert entrada["source"] == "EVENT"
