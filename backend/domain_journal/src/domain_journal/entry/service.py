"""Toda a regra de negocio da entrada de diario.

Handler nao decide nada; repository nao decide nada. Se uma decisao existe, ela
esta neste arquivo.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from domain_journal.entry.ids import UlidFactory
from domain_journal.entry.mappers import to_response
from domain_journal.entry.models import Entry
from shared_contracts import (
    ConfirmEntry,
    CreateEntry,
    DeleteEntry,
    DiagramShared,
    DomainEvent,
    EntryListResponse,
    EntryResponse,
    EntrySource,
    EntryStatus,
    GetEntry,
    GoalReached,
    ListEntries,
    NotFoundError,
    PromoteEntry,
    TaskCompleted,
    UpdateEntry,
    Visibility,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from domain_journal.entry.repository import EntryRepository

#: Eventos que viram rascunho de entrada. A tabela da secao 4, em codigo.
DRAFT_FROM_EVENT: dict[type[DomainEvent], str] = {
    TaskCompleted: "Tarefa concluida",
    GoalReached: "Meta atingida",
    DiagramShared: "Diagrama compartilhado",
}


class EntryService:
    def __init__(
        self,
        *,
        repository: EntryRepository,
        now: Callable[[], datetime] | None = None,
        ids: UlidFactory | None = None,
    ) -> None:
        self._repository = repository
        # Relogio injetado: sem isso, teste de periodo depende da data em que roda.
        self._now = now or (lambda: datetime.now(UTC))
        self._ids = ids or UlidFactory()

    # --------------------------------------------------------------- escrita manual

    def create(self, command: CreateEntry, *, user_id: str) -> EntryResponse:
        moment = self._now()
        entry = Entry(
            id=self._ids.new(moment),
            author_id=user_id,
            title=command.title,
            body=command.body,
            occurred_on=command.occurred_on,
            tags=command.tags,
            visibility=command.visibility,
            # Escrita manual e ato deliberado: ja nasce confirmada. Rascunho existe
            # para o que o sistema sugeriu, nao para o que voce digitou.
            status=EntryStatus.CONFIRMED,
            source=EntrySource.MANUAL,
            version=0,
            created_at=moment,
            updated_at=moment,
        )
        return to_response(self._repository.save(entry, expected_version=None))

    def update(self, command: UpdateEntry) -> EntryResponse:
        """Edicao de texto. Visibilidade e status ficam de fora por construcao."""
        entry = self._require(command.entry_id)
        edited = entry.edited(
            title=command.title,
            body=command.body,
            tags=command.tags,
            at=self._now(),
        )
        return to_response(self._repository.save(edited, command.expected_version))

    def promote(self, command: PromoteEntry) -> EntryResponse:
        """Unico caminho para mudar visibilidade.

        Separado de `update` de proposito: e o que garante que tornar uma entrada
        reportavel apareca como uma acao propria no log e no diff, nunca como
        efeito colateral de uma correcao de typo.
        """
        entry = self._require(command.entry_id)
        promoted = entry.with_visibility(command.visibility, at=self._now())
        return to_response(self._repository.save(promoted, command.expected_version))

    def confirm(self, command: ConfirmEntry) -> EntryResponse:
        entry = self._require(command.entry_id)
        return to_response(
            self._repository.save(entry.confirmed(at=self._now()), command.expected_version)
        )

    def delete(self, command: DeleteEntry) -> None:
        self._require(command.entry_id)
        self._repository.delete(command.entry_id)

    # ---------------------------------------------------------------------- leitura

    def get(self, command: GetEntry) -> EntryResponse:
        return to_response(self._require(command.entry_id))

    def list(self, command: ListEntries) -> EntryListResponse:
        entries = self._repository.list_by_period(command.start, command.end, tags=command.tags)
        if command.only_reportable:
            # O filtro acontece ANTES de qualquer composicao. E o ponto exato em
            # que uma observacao crua deixa de poder chegar a gestao.
            entries = [item for item in entries if item.visibility is Visibility.REPORTABLE]
        responses = tuple(to_response(item) for item in entries)
        return EntryListResponse(entries=responses, total=len(responses))

    # ----------------------------------------------------------------------- eventos

    def on_event(self, event: DomainEvent) -> None:
        """O diario se preenche sozinho por evento, nunca por consulta.

        `domain_journal` nao pergunta ao `domain_focus` o que foi concluido —
        pergunta seria import, e import seria o principio 3 quebrado.

        Entrada derivada nasce rascunho e PRIVATE, sempre. O sistema sugere o que
        voce fez; quem decide o que conta e voce.
        """
        prefix = DRAFT_FROM_EVENT.get(type(event))
        if prefix is None:
            return
        if self._already_recorded(event):
            return

        moment = self._now()
        entry = Entry(
            id=self._ids.new(moment),
            author_id=event.user_id,
            title=f"{prefix}: {_titulo_do_evento(event)}",
            body="",
            occurred_on=event.occurred_at.date(),
            tags=(),
            visibility=Visibility.PRIVATE,
            status=EntryStatus.DRAFT,
            source=EntrySource.EVENT,
            version=0,
            created_at=moment,
            updated_at=moment,
            origin_event_id=event.event_id,
        )
        self._repository.save(entry, expected_version=None)

    # ----------------------------------------------------------------------- interno

    def _require(self, entry_id: str) -> Entry:
        entry = self._repository.get(entry_id)
        if entry is None:
            raise NotFoundError(f"Entrada {entry_id} nao existe.")
        return entry

    def _already_recorded(self, event: DomainEvent) -> bool:
        """Barramento que reentrega nao pode duplicar o diario.

        Entrega ao menos uma vez e o padrao de qualquer barramento; sem esta
        guarda, um retry transformaria um evento em duas linhas do relatorio.
        """
        day = event.occurred_at.date()
        return any(
            item.origin_event_id == event.event_id
            for item in self._repository.list_by_period(day, day)
        )


def _titulo_do_evento(event: DomainEvent) -> str:
    title = getattr(event, "title", None)
    return title if isinstance(title, str) else event.event_id
