"""Regra de negocio de TOOLS.DNS: consulta o Google DNS-over-HTTPS.

O original fazia 6 chamadas sequenciais (A, AAAA, MX, TXT, CNAME, NS); aqui elas
saem em paralelo com `asyncio.gather` — a latencia da ferramenta passa a ser a
do tipo mais lento, nao a soma dos seis.

`NXDOMAIN` (Status 3) em um unico tipo e normal (a maioria dos dominios nao tem
registro MX, por exemplo). So vira `NotFoundError` quando os seis tipos
concordam que o dominio nao existe.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from shared_contracts import NotFoundError
from shared_contracts.tools import DNS_RECORD_TYPES, DnsQuery, DnsRecord, DnsResponse

if TYPE_CHECKING:
    from shared_contracts import HttpPort

GOOGLE_DOH_URL = "https://dns.google/resolve"
_NXDOMAIN = 3


class DnsService:
    def __init__(self, http: HttpPort) -> None:
        self._http = http

    async def lookup(self, query: DnsQuery) -> DnsResponse:
        resultados = await asyncio.gather(
            *(self._consulta(query.domain, tipo) for tipo in DNS_RECORD_TYPES)
        )
        if all(status == _NXDOMAIN for status, _ in resultados):
            raise NotFoundError(f"Dominio {query.domain} nao existe.")

        records = {
            tipo: registros
            for tipo, (_, registros) in zip(DNS_RECORD_TYPES, resultados, strict=True)
        }
        return DnsResponse(domain=query.domain, records=records)

    async def _consulta(self, domain: str, tipo: str) -> tuple[int, tuple[DnsRecord, ...]]:
        raw = await self._http.get_json(GOOGLE_DOH_URL, params={"name": domain, "type": tipo})
        document = _as_document(raw)
        return _number(document, "Status"), _answers(document)


def _as_document(raw: object) -> dict[str, object]:
    return raw if isinstance(raw, dict) else {}


def _answers(document: dict[str, object]) -> tuple[DnsRecord, ...]:
    raw_answers = document.get("Answer")
    if not isinstance(raw_answers, list):
        return ()
    return tuple(
        DnsRecord(name=_text(item, "name"), ttl=_number(item, "TTL"), data=_text(item, "data"))
        for item in raw_answers
        if isinstance(item, dict)
    )


def _text(document: dict[str, object], key: str) -> str:
    value = document.get(key)
    return value if isinstance(value, str) else ""


def _number(document: dict[str, object], key: str) -> int:
    value = document.get(key)
    return value if isinstance(value, int) else 0
