"""Modelo de dominio da entrada.

Mora dentro do micro-dominio, nao em shared_contracts: `Entry` nao e contrato
entre dominios, e o que o service manipula. O que sai pela fronteira e o
`EntryResponse`, montado por mapper explicito.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime

from shared_contracts import EntrySource, EntryStatus, Visibility


@dataclass(frozen=True, slots=True)
class Entry:
    """Fato datado. Imutavel em espirito — e imutavel de fato aqui.

    `frozen` torna toda mudanca uma copia explicita, o que impede o bug classico
    deste dominio: alterar `visibility` em memoria sem passar pelo caminho de
    promocao e persistir a mudanca sem querer.
    """

    id: str
    author_id: str
    title: str
    body: str
    occurred_on: date
    tags: tuple[str, ...]
    visibility: Visibility
    status: EntryStatus
    source: EntrySource
    version: int
    created_at: datetime
    updated_at: datetime
    origin_event_id: str | None = None

    @property
    def partition(self) -> str:
        """Uma entrada por arquivo, particionada por mes.

        Pasta com dez mil arquivos soltos e lenta para listar em qualquer sistema
        de arquivos.
        """
        return f"{self.occurred_on:%Y-%m}"

    def with_version(self, version: int) -> Entry:
        return replace(self, version=version)

    def edited(
        self,
        *,
        title: str | None,
        body: str | None,
        tags: tuple[str, ...] | None,
        at: datetime,
    ) -> Entry:
        """Edicao de texto. Nao toca em visibilidade nem em status, por construcao."""
        return replace(
            self,
            title=self.title if title is None else title,
            body=self.body if body is None else body,
            tags=self.tags if tags is None else tags,
            updated_at=at,
        )

    def with_visibility(self, visibility: Visibility, *, at: datetime) -> Entry:
        return replace(self, visibility=visibility, updated_at=at)

    def confirmed(self, *, at: datetime) -> Entry:
        return replace(self, status=EntryStatus.CONFIRMED, updated_at=at)
