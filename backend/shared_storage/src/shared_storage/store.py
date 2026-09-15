"""JsonStore: le, grava e lista documento por id numa colecao.

Ele NAO sabe o que e entrada, diagrama ou tarefa. Quem conhece o dominio e o
repository, que fica um nivel acima e informa quais campos vao para o indice.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator, Mapping, Sequence
from pathlib import Path

from shared_storage.atomic import JsonDocument, JsonValue, read_json, write_atomic
from shared_storage.errors import DocumentNotFoundError, VersionConflictError
from shared_storage.locks import PathLocks

INDEX_FILENAME = "_index.json"
INDEX_SCHEMA_VERSION = 1
_BASE_INDEX_FIELDS = ("id", "version", "partition")


class JsonStore:
    """Um arquivo por agregado, nunca um arquivo por colecao.

    Colecao inteira num arquivo so significa reescrever tudo a cada salvamento e
    serializar todo mundo no mesmo lock. Arquivo por agregado mantem a escrita
    proporcional ao que mudou.
    """

    def __init__(
        self, root: Path, *, index_fields: Mapping[str, Sequence[str]] | None = None
    ) -> None:
        """`index_fields` mapeia colecao -> campos de filtro, uma vez, no boot.

        Nao e parametro de `write` de proposito. Passado por chamada, um unico
        `write` que esquecesse o argumento tiraria o campo do indice sem erro
        nenhum — e a colecao passaria a mentir sobre o que contem ate alguem
        reconstruir. Configuracao por colecao torna esse esquecimento impossivel.

        O store continua sem conhecer dominio: recebe nomes de campo como dado de
        configuracao, nunca interpreta o que `visibility` significa.
        """
        self._root = Path(root)
        self._locks = PathLocks()
        self._index_fields: dict[str, tuple[str, ...]] = {
            collection: tuple(fields) for collection, fields in (index_fields or {}).items()
        }

    # ------------------------------------------------------------------ leitura

    def read(
        self, collection: str, doc_id: str, *, partition: str | None = None
    ) -> JsonDocument | None:
        """Le sob o lock do proprio documento.

        Nao e preciosismo: no Windows um handle de leitura aberto faz o
        `os.replace` de quem esta gravando falhar com PermissionError. Coordenar
        leitor e escritor no mesmo lock elimina a colisao em vez de retentar.
        """
        path = self._document_path(collection, doc_id, partition)
        with self._locks.acquire(str(path)):
            return read_json(path)

    def scan(self, collection: str, *, partitions: Iterable[str]) -> Iterator[JsonDocument]:
        """Varre apenas as particoes pedidas, em ordem de id.

        Busca textual passa por aqui com o filtro de periodo ja aplicado: sao
        dezenas de arquivos, nunca a colecao inteira.
        """
        for partition in partitions:
            directory = self._collection_path(collection) / partition
            if not directory.is_dir():
                continue
            for path in sorted(directory.glob("*.json")):
                if path.name.startswith("_"):
                    continue
                document = read_json(path)
                if document is not None:
                    yield document

    def read_index(self, collection: str) -> list[JsonDocument]:
        """Le o indice da colecao. Indice ausente ou ilegivel devolve lista vazia.

        Ele e derivado, nunca fonte de verdade — nao tem por que explodir a leitura
        de quem so queria listar. Quem precisa dele integro chama `rebuild_index`.
        """
        with self._locks.acquire(self._index_key(collection)):
            return self._read_index_unlocked(collection)

    def _read_index_unlocked(self, collection: str) -> list[JsonDocument]:
        path = self._index_path(collection)
        if not path.is_file():
            return []
        try:
            with path.open(encoding="utf-8") as handle:
                payload: JsonDocument = json.load(handle)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return []
        entries = payload.get("entries")
        if not isinstance(entries, list):
            return []
        return [entry for entry in entries if isinstance(entry, dict)]

    # ------------------------------------------------------------------ escrita

    def write(
        self,
        collection: str,
        doc_id: str,
        document: JsonDocument,
        *,
        partition: str | None = None,
        expected_version: int | None = None,
    ) -> JsonDocument:
        """Grava o agregado e atualiza o indice sob o mesmo lock.

        `expected_version=None` significa criacao: documento ja existente vira
        conflito em vez de sobrescrita silenciosa.
        """
        path = self._document_path(collection, doc_id, partition)
        with self._locks.acquire(str(path), self._index_key(collection)):
            current = read_json(path)
            current_version = _version_of(current)

            if expected_version is None:
                if current is not None:
                    raise VersionConflictError(0, current_version)
            elif current is None:
                raise DocumentNotFoundError(collection, doc_id)
            elif current_version != expected_version:
                raise VersionConflictError(expected_version, current_version)

            payload: JsonDocument = dict(document)
            payload["id"] = doc_id
            payload["version"] = current_version + 1
            write_atomic(path, payload)
            self._write_index_entry(collection, payload, partition)
            return payload

    def delete(self, collection: str, doc_id: str, *, partition: str | None = None) -> None:
        path = self._document_path(collection, doc_id, partition)
        with self._locks.acquire(str(path), self._index_key(collection)):
            path.unlink(missing_ok=True)
            remaining = [
                row for row in self._read_index_unlocked(collection) if row.get("id") != doc_id
            ]
            self._flush_index(collection, remaining)

    def rebuild_index(self, collection: str) -> list[JsonDocument]:
        """Reconstroi o indice varrendo a pasta.

        Indice que nao pode ser reconstruido e um banco de dados mal feito com
        outro nome. Este metodo e o que sustenta a afirmacao de que ele e derivado.
        """
        root = self._collection_path(collection)
        rows: list[JsonDocument] = []
        with self._locks.acquire(self._index_key(collection)):
            for path in sorted(root.rglob("*.json")):
                if path.name.startswith("_"):
                    continue
                document = read_json(path)
                if document is None:
                    continue
                partition = path.parent.name if path.parent != root else None
                rows.append(_index_row(document, partition, self._fields_for(collection)))
            self._flush_index(collection, rows)
        return rows

    # ------------------------------------------------------------------ interno

    def _collection_path(self, collection: str) -> Path:
        return self._root.joinpath(*collection.split("/"))

    def _document_path(self, collection: str, doc_id: str, partition: str | None) -> Path:
        base = self._collection_path(collection)
        directory = base if partition is None else base / partition
        return directory / f"{doc_id}.json"

    def _index_path(self, collection: str) -> Path:
        return self._collection_path(collection) / INDEX_FILENAME

    def _index_key(self, collection: str) -> str:
        return f"index::{collection}"

    def _fields_for(self, collection: str) -> tuple[str, ...]:
        return self._index_fields.get(collection, ())

    def _write_index_entry(
        self,
        collection: str,
        document: JsonDocument,
        partition: str | None,
    ) -> None:
        row = _index_row(document, partition, self._fields_for(collection))
        rows = [
            existing
            for existing in self._read_index_unlocked(collection)
            if existing.get("id") != row["id"]
        ]
        rows.append(row)
        rows.sort(key=lambda entry: str(entry.get("id", "")))
        self._flush_index(collection, rows)

    def _flush_index(self, collection: str, rows: list[JsonDocument]) -> None:
        payload: JsonDocument = {
            "schema_version": INDEX_SCHEMA_VERSION,
            "entries": list(rows),
        }
        write_atomic(self._index_path(collection), payload)


def _version_of(document: JsonDocument | None) -> int:
    if document is None:
        return 0
    raw = document.get("version", 0)
    return raw if isinstance(raw, int) else 0


def _index_row(
    document: JsonDocument, partition: str | None, index_fields: Sequence[str]
) -> JsonDocument:
    """So os campos de filtro entram no indice.

    Indice com o corpo do documento dentro vira um arquivo gigante relido a cada
    request — que e exatamente o problema que ele existe para evitar.
    """
    row: JsonDocument = {
        "id": document.get("id"),
        "version": document.get("version"),
        "partition": partition,
    }
    for field in index_fields:
        if field in document and field not in _BASE_INDEX_FIELDS:
            value: JsonValue = document[field]
            row[field] = value
    return row
