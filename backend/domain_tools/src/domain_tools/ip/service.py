"""Regra de negocio de TOOLS.IP: consulta o ipwho.is e traduz a resposta.

IP vazio consulta o endpoint sem segmento (`https://ipwho.is/`), que o provedor
resolve como "IP de quem chamou" — como a chamada agora sai do backend, e o IP
do proprio backend que volta, nao o do navegador do usuario.

O `asn`/`org` aparecem no topo do documento em alguns retornos do provedor e
aninhados em `connection` em outros (e o formato documentado hoje pelo
ipwho.is); o parser aceita os dois para nao depender de qual API o CEP e o DNS
usam.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from shared_contracts import NotFoundError
from shared_contracts.tools import IpQuery, IpResponse

if TYPE_CHECKING:
    from shared_contracts import HttpPort

IPWHOIS_URL = "https://ipwho.is/{ip}"


class IpService:
    def __init__(self, http: HttpPort) -> None:
        self._http = http

    async def locate(self, query: IpQuery) -> IpResponse:
        raw = await self._http.get_json(IPWHOIS_URL.format(ip=query.ip))
        document = _as_document(raw)
        if document.get("success") is False:
            raise NotFoundError(f"IP {query.ip or '(chamador)'} nao pode ser localizado.")

        connection = _as_document(document.get("connection"))
        return IpResponse(
            ip=_text(document, "ip"),
            country=_text(document, "country"),
            region=_text(document, "region"),
            city=_text(document, "city"),
            latitude=_number(document, "latitude"),
            longitude=_number(document, "longitude"),
            asn=_optional_int(document, "asn") or _optional_int(connection, "asn"),
            org=_text(document, "org") or _text(connection, "org"),
        )


def _as_document(raw: object) -> dict[str, object]:
    return raw if isinstance(raw, dict) else {}


def _text(document: dict[str, object], key: str) -> str:
    value = document.get(key)
    return value if isinstance(value, str) else ""


def _number(document: dict[str, object], key: str) -> float:
    value = document.get(key)
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else 0.0


def _optional_int(document: dict[str, object], key: str) -> int | None:
    value = document.get(key)
    return value if isinstance(value, int) and not isinstance(value, bool) else None
