"""Erros de armazenamento.

Existem separados dos erros de contrato de proposito: `shared_storage` nao importa
`shared_contracts` (secao 5). Quem traduz StorageError -> erro de dominio e o
repository, que e justamente a fronteira onde o detalhe de disco deve morrer.
"""

from __future__ import annotations


class StorageError(Exception):
    """Raiz dos erros de armazenamento."""


class DocumentNotFoundError(StorageError):
    def __init__(self, collection: str, doc_id: str) -> None:
        super().__init__(f"Documento {doc_id!r} nao existe em {collection!r}.")
        self.collection = collection
        self.doc_id = doc_id


class VersionConflictError(StorageError):
    """Versao otimista divergente. O agregado mudou entre a leitura e a gravacao."""

    def __init__(self, expected: int, actual: int) -> None:
        super().__init__(f"Versao esperada {expected}, encontrada {actual}.")
        self.expected = expected
        self.actual = actual


class IndexCorruptedError(StorageError):
    def __init__(self, collection: str) -> None:
        super().__init__(f"Indice de {collection!r} ilegivel. Reconstrua com rebuild_index.")
        self.collection = collection
