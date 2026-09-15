"""A flag e o unico mecanismo de roteamento do LeadBoard."""

from __future__ import annotations

import re
from dataclasses import dataclass

from shared_contracts.errors import InvalidFlagError

_SEGMENT = re.compile(r"^[A-Z0-9_]+$")


@dataclass(frozen=True, slots=True)
class Flag:
    """Formato DOMINIO.SUBDOMINIO.

    `frozen` da hashable e imutavel — a flag e chave do registry.
    `slots` corta o __dict__ de milhares de instancias por minuto.
    """

    domain: str
    subdomain: str

    @classmethod
    def parse(cls, raw: str) -> Flag:
        parts = [part.strip().upper() for part in raw.strip().split(".")]
        if len(parts) != 2 or not all(_SEGMENT.match(part) for part in parts):
            raise InvalidFlagError(raw)
        return cls(parts[0], parts[1])

    def __str__(self) -> str:
        return f"{self.domain}.{self.subdomain}"
