"""Passo 5 da ordem da secao 8: contrato de entrada e saida do handler."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from domain_tools.cep.handler import CepHandler
from domain_tools.cep.service import CepService
from shared_contracts import NotFoundError, RequestContext
from shared_contracts.tools import CepQuery


class HttpPortFake:
    def __init__(self, response: object) -> None:
        self._response = response

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object:
        return self._response


@pytest.fixture
def context() -> RequestContext:
    return RequestContext(request_id="req-1", received_at=datetime.now(UTC))


async def test_handler_devolve_o_dto_do_service(context: RequestContext) -> None:
    http = HttpPortFake(
        {"cep": "01001-000", "logradouro": "Praca da Se", "bairro": "Se",
         "localidade": "Sao Paulo", "uf": "SP", "ddd": "11"}
    )
    handler = CepHandler(CepService(http))
    resposta = await handler.handle(CepQuery(cep="01001000"), context)
    assert resposta.__class__.__name__ == "CepResponse"
    assert resposta.uf == "SP"


async def test_handler_propaga_not_found(context: RequestContext) -> None:
    http = HttpPortFake({"erro": True})
    handler = CepHandler(CepService(http))
    with pytest.raises(NotFoundError):
        await handler.handle(CepQuery(cep="00000000"), context)
