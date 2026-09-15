"""Geracao de ULID monotonico.

ULID em vez de UUIDv4 porque a ordenacao lexicografica e igual a cronologica:
listar `data/journal/entry/2026-09/` ja sai em ordem, sem abrir um unico arquivo.

Monotonico porque o timestamp tem resolucao de milissegundo. Duas entradas
criadas no mesmo milissegundo — o que acontece sempre que uma rajada de eventos
vira rascunho de uma vez — teriam a ordem decidida pelos bytes aleatorios, ou
seja, embaralhada. A especificacao resolve isso incrementando a parte aleatoria
enquanto o timestamp nao muda.
"""

from __future__ import annotations

import secrets
import threading
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from datetime import datetime

#: Crockford Base32: sem I, L, O e U, para nao confundir com 1, 0 e obscenidade.
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
TIMESTAMP_CHARS = 10
RANDOM_CHARS = 16
RANDOM_BITS = 80
ULID_LENGTH = TIMESTAMP_CHARS + RANDOM_CHARS


class UlidFactory:
    """Gerador com estado. Instancia por processo, protegida por lock.

    O estado (ultimo timestamp e ultima aleatoriedade) e o que torna a sequencia
    monotonica; o lock e o que a mantem correta quando varios handlers gravam em
    paralelo no threadpool.
    """

    def __init__(self) -> None:
        self._guard = threading.Lock()
        self._last_ms = -1
        self._last_random = 0

    def new(self, moment: datetime) -> str:
        milliseconds = int(moment.timestamp() * 1000)
        with self._guard:
            if milliseconds == self._last_ms:
                # Mesmo milissegundo: incrementar em vez de sortear de novo, ou a
                # ordem entre as duas entradas vira loteria.
                self._last_random += 1
                if self._last_random >= 1 << RANDOM_BITS:
                    milliseconds += 1
                    self._last_random = secrets.randbits(RANDOM_BITS)
            else:
                # Relogio que anda para tras (ajuste de NTP, horario de verao) nao
                # pode gerar id menor que o anterior: o passado ja foi escrito.
                milliseconds = max(milliseconds, self._last_ms)
                self._last_random = secrets.randbits(RANDOM_BITS)
            self._last_ms = milliseconds
            randomness = self._last_random

        return _encode(milliseconds, TIMESTAMP_CHARS) + _encode(randomness, RANDOM_CHARS)


def _encode(value: int, length: int) -> str:
    chars = [""] * length
    for position in range(length - 1, -1, -1):
        chars[position] = ALPHABET[value & 0x1F]
        value >>= 5
    return "".join(chars)
