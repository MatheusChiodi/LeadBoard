"""Regra de negocio de TOOLS.CEP: consulta o ViaCEP e traduz a resposta.

Nao ha regra alem de "existe ou nao existe". O ViaCEP devolve HTTP 200 tanto
para CEP valido quanto para CEP inexistente — so muda o corpo do JSON, que
carrega `{"erro": true}`. Cabe ao service, nao ao handler, traduzir isso para o
`NotFoundError` de dominio (principio de erro de dominio, nunca HTTPException).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from shared_contracts import NotFoundError
from shared_contracts.tools import CepQuery, CepResponse

if TYPE_CHECKING:
    from shared_contracts import HttpPort

VIACEP_URL = "https://viacep.com.br/ws/{cep}/json/"


class CepService:
    def __init__(self, http: HttpPort) -> None:
        self._http = http

    async def lookup(self, query: CepQuery) -> CepResponse:
        raw = await self._http.get_json(VIACEP_URL.format(cep=query.cep))
        document = _as_document(raw)
        if document.get("erro") is True:
            raise NotFoundError(f"CEP {query.cep} nao existe.")
        return CepResponse(
            cep=_text(document, "cep"),
            logradouro=_text(document, "logradouro"),
            bairro=_text(document, "bairro"),
            localidade=_text(document, "localidade"),
            uf=_text(document, "uf"),
            ddd=_text(document, "ddd"),
        )


def _as_document(raw: object) -> dict[str, object]:
    return raw if isinstance(raw, dict) else {}


def _text(document: dict[str, object], key: str) -> str:
    value = document.get(key)
    return value if isinstance(value, str) else ""
