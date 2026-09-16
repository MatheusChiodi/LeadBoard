"""Ponto de entrada do dominio tools.

Publicado como entry point `leadboard.handlers`. O core chama esta funcao sem
importar `domain_tools` por nome — e e isso que mantem a regra de dependencia intacta.

Unico lugar do dominio onde a composicao acontece: o AppContext entra uma vez,
aqui, e sai como factories ja ligadas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from shared_contracts import AppContext, HandlerSpec


def handlers(app: AppContext) -> list[HandlerSpec]:
    return []
