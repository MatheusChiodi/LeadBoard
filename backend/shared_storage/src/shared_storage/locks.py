"""Locks por caminho, dentro do processo.

Banco resolve escrita simultanea por voce. Arquivo nao. O repository e sincrono e
o FastAPI roda handler sincrono no threadpool — logo multiplas threads podem
gravar o mesmo arquivo ao mesmo tempo.

Se um dia a aplicacao subir com `uvicorn --workers 2`, este lock deixa de valer e
passa a ser necessario lock de arquivo (`filelock`/`fcntl.flock`). Enquanto for um
processo so nao vale pagar esse custo — mas a decisao precisa estar escrita,
porque no dia em que alguem aumentar o numero de workers a corrupcao e silenciosa.
A versao otimista do agregado continua valendo nos dois cenarios.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterator


class PathLocks:
    """Um `threading.Lock` por chave, criado sob demanda.

    Os locks nao sao descartados: a quantidade de caminhos vivos e da ordem dos
    documentos tocados na sessao, e um dicionario disso e barato perto do risco de
    liberar um lock enquanto outra thread ainda o espera.
    """

    def __init__(self) -> None:
        self._guard = threading.Lock()
        self._locks: dict[str, threading.Lock] = {}

    def _lock(self, key: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    @contextmanager
    def acquire(self, *keys: str) -> Iterator[None]:
        """Adquire varios locks em ordem estavel.

        A ordenacao e o que impede deadlock quando duas threads pegam o lock do
        documento e o do indice ao mesmo tempo: todo mundo adquire na mesma ordem.
        """
        ordered = sorted(set(keys))
        acquired: list[threading.Lock] = []
        try:
            for key in ordered:
                lock = self._lock(key)
                lock.acquire()
                acquired.append(lock)
            yield
        finally:
            for lock in reversed(acquired):
                lock.release()
