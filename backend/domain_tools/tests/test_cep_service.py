"""Passo 1 da ordem da secao 8: teste do service, com porta falsa tipada."""

from __future__ import annotations

import pytest

from domain_tools.cep.service import CepService
from shared_contracts import NotFoundError
from shared_contracts.tools import CepQuery


class HttpPortFake:
    """Implementa o mesmo Protocol de `HttpPort`, nunca um MagicMock."""

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


async def test_cep_valido_devolve_endereco() -> None:
    http = HttpPortFake(
        {
            "cep": "01001-000",
            "logradouro": "Praca da Se",
            "bairro": "Se",
            "localidade": "Sao Paulo",
            "uf": "SP",
            "ddd": "11",
        }
    )
    resposta = await CepService(http).lookup(CepQuery(cep="01001000"))
    assert resposta.logradouro == "Praca da Se"
    assert resposta.localidade == "Sao Paulo"
    assert resposta.uf == "SP"
    assert resposta.ddd == "11"


async def test_cep_inexistente_e_not_found() -> None:
    """ViaCEP devolve HTTP 200 tanto para CEP valido quanto inexistente."""
    http = HttpPortFake({"erro": True})
    with pytest.raises(NotFoundError):
        await CepService(http).lookup(CepQuery(cep="00000000"))


async def test_cep_chama_a_url_do_viacep_com_o_cep_normalizado() -> None:
    http = HttpPortFake(
        {"cep": "", "logradouro": "", "bairro": "", "localidade": "", "uf": "", "ddd": ""}
    )
    await CepService(http).lookup(CepQuery(cep="01001-000"))
    assert http.urls == ["https://viacep.com.br/ws/01001000/json/"]
