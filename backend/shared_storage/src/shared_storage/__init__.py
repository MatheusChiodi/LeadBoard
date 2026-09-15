"""Mecanica de gravar e ler arquivo. Sem regra de negocio, sem conhecer dominio.

Importa NINGUEM — nem `shared_contracts`. A traducao de StorageError para erro de
dominio e responsabilidade do repository, que e a fronteira onde o detalhe de
disco deve morrer.
"""

from shared_storage.atomic import JsonDocument, JsonValue, read_json, write_atomic
from shared_storage.errors import (
    DocumentNotFoundError,
    IndexCorruptedError,
    StorageError,
    VersionConflictError,
)
from shared_storage.locks import PathLocks
from shared_storage.store import INDEX_FILENAME, INDEX_SCHEMA_VERSION, JsonStore

__all__ = [
    "INDEX_FILENAME",
    "INDEX_SCHEMA_VERSION",
    "DocumentNotFoundError",
    "IndexCorruptedError",
    "JsonDocument",
    "JsonStore",
    "JsonValue",
    "PathLocks",
    "StorageError",
    "VersionConflictError",
    "read_json",
    "write_atomic",
]
