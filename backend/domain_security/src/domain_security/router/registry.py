"""Registry de flags: montado no boot, imutavel depois.

A varredura de anotacao do Java vira entry points. Cada dominio se anuncia, o core
le o que foi anunciado — e assim `domain_security` nunca faz `import domain_user`.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from importlib.metadata import entry_points
from typing import TYPE_CHECKING

from shared_contracts import DuplicateFlagError, Flag, HandlerSpec

if TYPE_CHECKING:
    from shared_contracts import AppContext

ENTRY_POINT_GROUP = "leadboard.handlers"


class Registry:
    """Mapa flag -> spec. Duplicata explode na subida, nunca em producao."""

    def __init__(self, specs: dict[Flag, HandlerSpec]) -> None:
        self._specs = dict(specs)

    @classmethod
    def from_specs(cls, specs: Iterable[HandlerSpec]) -> Registry:
        resolved: dict[Flag, HandlerSpec] = {}
        for spec in specs:
            if spec.flag in resolved:
                raise DuplicateFlagError(spec.flag)
            resolved[spec.flag] = spec
        return cls(resolved)

    @classmethod
    def discover(cls, app_context: AppContext) -> Registry:
        """Le os entry points e monta o registry.

        Cada dominio publica uma funcao que recebe o `AppContext` e devolve suas
        specs com as dependencias ja ligadas. O core chama essa funcao sem nunca
        importar o pacote do dominio por nome.
        """
        collected: list[HandlerSpec] = []
        for entry in entry_points(group=ENTRY_POINT_GROUP):
            collected.extend(entry.load()(app_context))
        return cls.from_specs(collected)

    def __contains__(self, flag: object) -> bool:
        return flag in self._specs

    def __iter__(self) -> Iterator[Flag]:
        return iter(self._specs)

    def __len__(self) -> int:
        return len(self._specs)

    def get(self, flag: Flag) -> HandlerSpec | None:
        return self._specs.get(flag)

    def flags(self) -> tuple[Flag, ...]:
        return tuple(sorted(self._specs, key=str))
