"""DTOs do dominio Journal.

Uma flag por micro-dominio e uma restricao do contrato da secao 3, mas `entry`
tem mais de uma operacao. Em vez de inventar `JOURNAL.ENTRY_CREATE` — que quebra
o formato DOMINIO.SUBDOMINIO — a operacao entra no payload como uniao
discriminada. O Pydantic valida o comando certo pelo campo `op`, e o handler faz
o despacho interno com o type checker cobrindo os casos.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Visibility(StrEnum):
    """O campo mais importante do dominio.

    O diario de tech lead contem observacao crua — alguem travou, alguem entregou
    tarde, uma decisao foi ruim. Isso precisa existir para voce lembrar e NAO pode
    vazar para o relatorio por esquecimento.
    """

    PRIVATE = "PRIVATE"
    REPORTABLE = "REPORTABLE"


class EntryStatus(StrEnum):
    """Entrada derivada de evento nasce rascunho, nunca registro confirmado.

    O sistema sugere o que voce fez; quem decide o que conta e voce.
    """

    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"


class EntrySource(StrEnum):
    MANUAL = "MANUAL"
    EVENT = "EVENT"


class _Command(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class CreateEntry(_Command):
    op: Literal["create"] = "create"
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    occurred_on: date
    tags: tuple[str, ...] = ()
    # Default PRIVATE, sempre. Promover e ato explicito, nunca efeito colateral.
    visibility: Visibility = Visibility.PRIVATE


class UpdateEntry(_Command):
    op: Literal["update"] = "update"
    entry_id: str
    expected_version: int
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    tags: tuple[str, ...] | None = None


class PromoteEntry(_Command):
    """Promocao de visibilidade e comando proprio, separado de `update`.

    Se fosse um campo de `update`, um PATCH que so queria corrigir um typo
    poderia tornar a entrada reportavel sem que ninguem percebesse no diff.
    """

    op: Literal["promote"] = "promote"
    entry_id: str
    expected_version: int
    visibility: Visibility


class ConfirmEntry(_Command):
    op: Literal["confirm"] = "confirm"
    entry_id: str
    expected_version: int


class ListEntries(_Command):
    op: Literal["list"] = "list"
    start: date
    end: date
    only_reportable: bool = False
    tags: tuple[str, ...] = ()


class GetEntry(_Command):
    op: Literal["get"] = "get"
    entry_id: str


class DeleteEntry(_Command):
    op: Literal["delete"] = "delete"
    entry_id: str
    expected_version: int


EntryCommandUnion = Annotated[
    CreateEntry | UpdateEntry | PromoteEntry | ConfirmEntry | ListEntries | GetEntry | DeleteEntry,
    Field(discriminator="op"),
]


class EntryCommand(RootModel[EntryCommandUnion]):
    """Envelope que o registry declara como `payload_model` da flag JOURNAL.ENTRY."""


class EntryResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
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


class EntryListResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    entries: tuple[EntryResponse, ...]
    total: int


class EntryDeletedResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    deleted: bool = True
