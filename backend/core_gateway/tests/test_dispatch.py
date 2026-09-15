from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, ConfigDict

from core_gateway import create_app
from domain_security import AppSecurity, JwtTokenIssuer, Registry, Router
from shared_contracts import ForbiddenError, NotFoundError, RequestContext, domain_flag, spec_of

SECRET = "segredo-de-teste-com-mais-de-32-bytes-para-o-gateway"


class NotaRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    titulo: str


class NotaResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    titulo: str
    autor: str


@domain_flag(domain="DEMO", subdomain="NOTA", payload=NotaRequest)
class NotaHandler:
    def handle(self, payload: NotaRequest, context: RequestContext) -> NotaResponse:
        return NotaResponse(titulo=payload.titulo, autor=context.require_identity().user_id)


@domain_flag(domain="DEMO", subdomain="SUMIU", payload=NotaRequest)
class SumiuHandler:
    def handle(self, payload: NotaRequest, context: RequestContext) -> NotaResponse:
        raise NotFoundError("Nota nao encontrada.")


@domain_flag(domain="DEMO", subdomain="NEGADO", payload=NotaRequest)
class NegadoHandler:
    def handle(self, payload: NotaRequest, context: RequestContext) -> NotaResponse:
        raise ForbiddenError("Sem acesso.")


@domain_flag(domain="DEMO", subdomain="EXPLODE", payload=NotaRequest)
class ExplodeHandler:
    def handle(self, payload: NotaRequest, context: RequestContext) -> NotaResponse:
        raise RuntimeError("detalhe interno que nao pode vazar para o cliente")


class SemPermissoes:
    def permissions_for(self, user_id: str) -> frozenset[str]:
        return frozenset()


@pytest.fixture
def issuer() -> JwtTokenIssuer:
    return JwtTokenIssuer(secret=SECRET, ttl=timedelta(hours=1))


@pytest.fixture
def token(issuer: JwtTokenIssuer) -> str:
    return issuer.issue("u1", frozenset())


@pytest.fixture
def client(issuer: JwtTokenIssuer) -> AsyncClient:
    registry = Registry.from_specs(
        [
            spec_of(NotaHandler, NotaHandler),
            spec_of(SumiuHandler, SumiuHandler),
            spec_of(NegadoHandler, NegadoHandler),
            spec_of(ExplodeHandler, ExplodeHandler),
        ]
    )
    app = create_app(
        router=Router(registry=registry),
        security=AppSecurity(
            issuer=issuer, permissions=SemPermissoes(), public_flags={"DEMO.PUBLICO"}
        ),
    )
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _post(
    client: AsyncClient, flag: str, payload: object, token: str | None = None
) -> object:
    headers = {"X-Domain-Flag": flag}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    return await client.post("/api/dispatch", headers=headers, json=payload)


# ------------------------------------------------------------------- sucesso


async def test_request_valida_chega_ao_handler(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "DEMO.NOTA", {"titulo": "incidente"}, token)
    assert response.status_code == 200
    assert response.json() == {"titulo": "incidente", "autor": "u1"}


async def test_flag_e_normalizada_para_maiusculas(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "demo.nota", {"titulo": "x"}, token)
    assert response.status_code == 200


# --------------------------------------------------------------- erro de contrato


async def test_flag_desconhecida_retorna_422(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "DEMO.NAOEXISTE", {}, token)
    assert response.status_code == 422
    assert "DEMO.NAOEXISTE" in response.text


async def test_flag_mal_formada_retorna_422(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "SEMPONTO", {}, token)
    assert response.status_code == 422


async def test_header_de_flag_ausente_retorna_422(client: AsyncClient, token: str) -> None:
    async with client:
        response = await client.post(
            "/api/dispatch", headers={"Authorization": f"Bearer {token}"}, json={}
        )
    assert response.status_code == 422


async def test_campo_desconhecido_no_payload_retorna_422(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "DEMO.NOTA", {"titulo": "x", "intruso": 1}, token)
    assert response.status_code == 422


# ----------------------------------------------------------------- autenticacao


async def test_request_sem_token_morre_com_401(client: AsyncClient) -> None:
    async with client:
        response = await _post(client, "DEMO.NOTA", {"titulo": "x"})
    assert response.status_code == 401


async def test_token_invalido_morre_com_401(client: AsyncClient) -> None:
    async with client:
        response = await _post(client, "DEMO.NOTA", {"titulo": "x"}, "token-falso")
    assert response.status_code == 401


# -------------------------------------------------------- traducao de erro de dominio


async def test_erro_de_dominio_vira_o_status_que_ele_declara(
    client: AsyncClient, token: str
) -> None:
    async with client:
        ausente = await _post(client, "DEMO.SUMIU", {"titulo": "x"}, token)
        negado = await _post(client, "DEMO.NEGADO", {"titulo": "x"}, token)
    assert ausente.status_code == 404
    assert negado.status_code == 403


async def test_erro_inesperado_vira_500_sem_vazar_detalhe(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "DEMO.EXPLODE", {"titulo": "x"}, token)
    assert response.status_code == 500
    assert "detalhe interno" not in response.text


async def test_toda_resposta_de_erro_carrega_o_request_id(client: AsyncClient, token: str) -> None:
    """Com uma unica URL para tudo, o request id e o que torna o log rastreavel."""
    async with client:
        response = await _post(client, "DEMO.SUMIU", {"titulo": "x"}, token)
    assert response.json()["request_id"]
    assert response.headers["X-Request-Id"] == response.json()["request_id"]


async def test_resposta_de_erro_declara_a_flag(client: AsyncClient, token: str) -> None:
    async with client:
        response = await _post(client, "DEMO.SUMIU", {"titulo": "x"}, token)
    assert response.json()["flag"] == "DEMO.SUMIU"


# ------------------------------------------------------------------- saude


async def test_health_nao_passa_pelo_security(client: AsyncClient) -> None:
    async with client:
        response = await client.get("/api/health")
    assert response.status_code == 200
