"""Contrato e implementacao em arquivo do repositorio de entradas.

Assinatura de banco, implementacao de arquivo. Nada no `Protocol` entrega o
formato: sem `path`, sem `filename`, sem `flush`. No dia em que existir um
`SqlEntryRepository`, ele preenche o mesmo contrato e a bateria de testes da
secao 8 diz se esta correto.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import TYPE_CHECKING, Protocol

from domain_journal.entry.models import Entry
from shared_contracts import EntrySource, EntryStatus, NotFoundError, Visibility
from shared_contracts import VersionConflictError as DomainVersionConflict
from shared_storage import DocumentNotFoundError, JsonDocument, JsonStore
from shared_storage import VersionConflictError as StorageVersionConflict

if TYPE_CHECKING:
    from collections.abc import Iterator

COLLECTION = "journal/entry"
SCHEMA_VERSION = 1

#: Campos de filtro que vao para o `_index.json`. O corpo em markdown fica so no
#: arquivo: indice com o texto inteiro dentro vira um arquivo gigante relido a
#: cada request.
INDEX_FIELDS = ("occurred_on", "tags", "visibility", "status", "author_id")


class EntryRepository(Protocol):
    def get(self, entry_id: str) -> Entry | None: ...

    def list_by_period(
        self, start: date, end: date, *, tags: tuple[str, ...] = ()
    ) -> list[Entry]: ...

    def save(self, entry: Entry, expected_version: int | None) -> Entry: ...

    def delete(self, entry_id: str) -> None: ...


class JsonEntryRepository:
    """Aqui morre o `dict`.

    O documento lido do arquivo nunca sai desta classe: o que atravessa a
    fronteira e sempre `Entry`. Service que recebe `dict` amarra o sistema ao
    JSON para sempre.
    """

    def __init__(self, store: JsonStore) -> None:
        self._store = store

    # ------------------------------------------------------------------ leitura

    def get(self, entry_id: str) -> Entry | None:
        for partition in self._partitions_of(entry_id):
            document = self._store.read(COLLECTION, entry_id, partition=partition)
            if document is not None:
                return _to_entry(document)
        return None

    def list_by_period(self, start: date, end: date, *, tags: tuple[str, ...] = ()) -> list[Entry]:
        """Varredura sobre as particoes do periodo, nunca sobre a colecao toda.

        Com o filtro de data aplicado antes, isso sao dezenas de arquivos.
        """
        wanted = set(tags)
        found: list[Entry] = []
        for document in self._store.scan(COLLECTION, partitions=_months_between(start, end)):
            entry = _to_entry(document)
            if not (start <= entry.occurred_on <= end):
                continue
            if wanted and not wanted & set(entry.tags):
                continue
            found.append(entry)
        return sorted(found, key=lambda item: (item.occurred_on, item.id))

    # ------------------------------------------------------------------ escrita

    def save(self, entry: Entry, expected_version: int | None) -> Entry:
        try:
            document = self._store.write(
                COLLECTION,
                entry.id,
                _to_document(entry),
                partition=entry.partition,
                expected_version=expected_version,
            )
        except StorageVersionConflict as exc:
            raise DomainVersionConflict(exc.expected, exc.actual) from exc
        except DocumentNotFoundError as exc:
            raise NotFoundError(f"Entrada {entry.id} nao existe.") from exc
        return _to_entry(document)

    def delete(self, entry_id: str) -> None:
        for partition in self._partitions_of(entry_id):
            if self._store.read(COLLECTION, entry_id, partition=partition) is not None:
                self._store.delete(COLLECTION, entry_id, partition=partition)
                return

    # ------------------------------------------------------------------- interno

    def _partitions_of(self, entry_id: str) -> Iterator[str]:
        """Onde procurar um documento de que so se conhece o id.

        O indice diz em que mes ele esta, o que evita varrer a colecao. Mas o
        indice e derivado, nao autoridade: se ele estiver divergente, o fallback
        e tentar todas as particoes conhecidas antes de declarar que nao existe.
        """
        known: list[str] = []
        exact: str | None = None
        for row in self._store.read_index(COLLECTION):
            partition = row.get("partition")
            if not isinstance(partition, str):
                continue
            if partition not in known:
                known.append(partition)
            if row.get("id") == entry_id:
                exact = partition

        if exact is not None:
            yield exact
        for partition in known:
            if partition != exact:
                yield partition


def _to_document(entry: Entry) -> JsonDocument:
    """Mapper explicito de dominio para armazenamento."""
    return {
        "schema_version": SCHEMA_VERSION,
        "author_id": entry.author_id,
        "title": entry.title,
        "body": entry.body,
        "occurred_on": entry.occurred_on.isoformat(),
        "tags": list(entry.tags),
        "visibility": entry.visibility.value,
        "status": entry.status.value,
        "source": entry.source.value,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
        "origin_event_id": entry.origin_event_id,
    }


def _to_entry(document: JsonDocument) -> Entry:
    """Mapper explicito de armazenamento para dominio.

    Cada campo e lido e convertido na mao. Um `Entry(**document)` aceitaria
    qualquer chave e transformaria mudanca de schema em erro silencioso.
    """
    return Entry(
        id=_text(document, "id"),
        author_id=_text(document, "author_id"),
        title=_text(document, "title"),
        body=_text(document, "body"),
        occurred_on=date.fromisoformat(_text(document, "occurred_on")),
        tags=tuple(_texts(document, "tags")),
        visibility=Visibility(_text(document, "visibility")),
        status=EntryStatus(_text(document, "status")),
        source=EntrySource(_text(document, "source")),
        version=_number(document, "version"),
        created_at=_moment(document, "created_at"),
        updated_at=_moment(document, "updated_at"),
        origin_event_id=_optional_text(document, "origin_event_id"),
    )


def _text(document: JsonDocument, key: str) -> str:
    value = document.get(key)
    return value if isinstance(value, str) else ""


def _optional_text(document: JsonDocument, key: str) -> str | None:
    value = document.get(key)
    return value if isinstance(value, str) else None


def _texts(document: JsonDocument, key: str) -> list[str]:
    value = document.get(key)
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def _number(document: JsonDocument, key: str) -> int:
    value = document.get(key)
    return value if isinstance(value, int) else 0


def _moment(document: JsonDocument, key: str) -> datetime:
    raw = _text(document, key)
    return datetime.fromisoformat(raw) if raw else datetime.now(UTC)


def _months_between(start: date, end: date) -> list[str]:
    months: list[str] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append(f"{year:04d}-{month:02d}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months
