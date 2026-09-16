"""DTOs de TOOLS.CEP, TOOLS.DNS e TOOLS.IP.

Validacao de entrada mora no DTO, nao no service: assim o erro vira 422 antes de
qualquer chamada de rede ser sequer cogitada.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from shared_contracts.tools import CepQuery, DnsQuery, IpQuery

# ------------------------------------------------------------------------- cep


def test_cep_aceita_apenas_digitos() -> None:
    assert CepQuery(cep="01001000").cep == "01001000"


def test_cep_normaliza_formatacao_com_hifen() -> None:
    assert CepQuery(cep="01001-000").cep == "01001000"


@pytest.mark.parametrize("valor", ["123", "123456789", "abcdefgh", ""])
def test_cep_fora_do_padrao_e_erro_de_validacao(valor: str) -> None:
    with pytest.raises(ValidationError):
        CepQuery(cep=valor)


def test_cep_query_e_imutavel_e_fecha_campo_extra() -> None:
    query = CepQuery(cep="01001000")
    with pytest.raises(ValidationError):
        CepQuery(cep="01001000", extra="nao existe")  # type: ignore[call-arg]
    with pytest.raises(Exception):  # noqa: B017 — frozen dataclass Pydantic
        query.cep = "99999999"  # type: ignore[misc]


# ------------------------------------------------------------------------- dns


def test_dominio_plausivel_e_aceito() -> None:
    assert DnsQuery(domain="Exemplo.COM.br").domain == "exemplo.com.br"


@pytest.mark.parametrize("valor", ["", "sem-ponto", "-invalido.com", "com.", ".com"])
def test_dominio_implausivel_e_erro_de_validacao(valor: str) -> None:
    with pytest.raises(ValidationError):
        DnsQuery(domain=valor)


# -------------------------------------------------------------------------- ip


def test_ip_vazio_significa_ip_de_quem_chamou() -> None:
    assert IpQuery().ip == ""


def test_ipv4_valido_e_aceito() -> None:
    assert IpQuery(ip="8.8.8.8").ip == "8.8.8.8"


def test_ipv6_valido_e_aceito() -> None:
    assert IpQuery(ip="2001:4860:4860::8888").ip == "2001:4860:4860::8888"


def test_ip_invalido_e_erro_de_validacao() -> None:
    with pytest.raises(ValidationError):
        IpQuery(ip="nao-e-um-ip")
