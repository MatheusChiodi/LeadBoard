"""Mapper explicito de dominio para DTO.

Toda resposta sai como DTO Pydantic. `Entry` nunca atravessa a fronteira HTTP:
expor o modelo interno faria qualquer renomeacao de campo virar quebra de
contrato com o frontend.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from shared_contracts import EntryResponse

if TYPE_CHECKING:
    from domain_journal.entry.models import Entry


def to_response(entry: Entry) -> EntryResponse:
    return EntryResponse(
        id=entry.id,
        title=entry.title,
        body=entry.body,
        occurred_on=entry.occurred_on,
        tags=entry.tags,
        visibility=entry.visibility,
        status=entry.status,
        source=entry.source,
        version=entry.version,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )
