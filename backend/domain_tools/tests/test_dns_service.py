"""Passo 1 da ordem da secao 8, para TOOLS.DNS.

O original fazia 6 chamadas sequenciais (A, AAAA, MX, TXT, CNAME, NS); o service
faz as 6 em paralelo com `asyncio.gather` e o teste de concorrencia verifica isso
sem depender de tempo de relogio.
"""

from __future__ import annotations

import asyncio

import pytest

from domain_tools.dns.service import DnsService
from shared_contracts import NotFoundError
from shared_contracts.tools import DNS_RECORD_TYPES, DnsQuery


def _resposta_google(
    *, status: int = 0, answers: list[dict[str, object]] | None = None
) -> dict[str, object]:
    body: dict[str, object] = {"Status": status}
    if answers is not None:
        body["Answer"] = answers
    return body


class HttpPortFake:
    """Devolve resposta por tipo consultado e registra concorrencia observada."""

    def __init__(self, by_type: dict[str, dict[str, object]]) -> None:
        self._by_type = by_type
        self.em_voo = 0
        self.pico_em_voo = 0

    async def get_json(
        self,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> object:
        self.em_voo += 1
        self.pico_em_voo = max(self.pico_em_voo, self.em_voo)
        await asyncio.sleep(0)  # cede o loop: se fosse sequencial, pico ficaria em 1
        tipo = (params or {}).get("type", "")
        self.em_voo -= 1
        return self._by_type.get(tipo, _resposta_google(status=0))


async def test_consultas_por_tipo_acontecem_em_paralelo() -> None:
    http = HttpPortFake({tipo: _resposta_google(status=0) for tipo in DNS_RECORD_TYPES})
    await DnsService(http).lookup(DnsQuery(domain="exemplo.com"))
    assert http.pico_em_voo == len(DNS_RECORD_TYPES)


async def test_registros_a_aparecem_sob_a_chave_a() -> None:
    http = HttpPortFake(
        {
            "A": _resposta_google(
                answers=[{"name": "exemplo.com.", "type": 1, "TTL": 300, "data": "93.184.216.34"}]
            ),
        }
    )
    resposta = await DnsService(http).lookup(DnsQuery(domain="exemplo.com"))
    (registro,) = resposta.records["A"]
    assert registro.data == "93.184.216.34"
    assert registro.ttl == 300


async def test_tipo_sem_registro_devolve_tupla_vazia_sem_erro() -> None:
    http = HttpPortFake({tipo: _resposta_google(status=0) for tipo in DNS_RECORD_TYPES})
    resposta = await DnsService(http).lookup(DnsQuery(domain="exemplo.com"))
    assert resposta.records["MX"] == ()


async def test_dominio_inexistente_em_todos_os_tipos_e_not_found() -> None:
    http = HttpPortFake({tipo: _resposta_google(status=3) for tipo in DNS_RECORD_TYPES})
    with pytest.raises(NotFoundError):
        await DnsService(http).lookup(DnsQuery(domain="nao-existe-de-verdade.com"))


async def test_nxdomain_em_um_unico_tipo_nao_e_erro() -> None:
    """MX ausente (NXDOMAIN so nesse tipo) e normal; A resolvendo prova que o dominio existe."""
    respostas = {tipo: _resposta_google(status=0) for tipo in DNS_RECORD_TYPES}
    respostas["MX"] = _resposta_google(status=3)
    http = HttpPortFake(respostas)
    resposta = await DnsService(http).lookup(DnsQuery(domain="exemplo.com"))
    assert resposta.records["MX"] == ()
