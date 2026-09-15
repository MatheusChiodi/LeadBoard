"""Ponto de entrada do dominio Journal.

Publicado como entry point `leadboard.handlers` no pyproject. O core chama esta
funcao sem nunca importar `domain_journal` por nome — e e isso que mantem a regra
de dependencia da secao 5 intacta.

Este e tambem o unico lugar do dominio onde a composicao acontece: o AppContext
entra uma vez, aqui, e sai como factories ja ligadas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from domain_journal.entry.handler import EntryHandler
from domain_journal.entry.repository import COLLECTION, INDEX_FIELDS, JsonEntryRepository
from domain_journal.entry.service import EntryService
from shared_contracts import HandlerSpec, TaskCompleted, spec_of
from shared_contracts.events import DiagramShared, GoalReached
from shared_storage import JsonStore

if TYPE_CHECKING:
    from shared_contracts import AppContext

#: Campos de filtro de cada colecao do dominio. O JsonStore nao adivinha: quem
#: conhece o formato do agregado e o dominio.
INDEX_LAYOUT = {COLLECTION: INDEX_FIELDS}


def handlers(app: AppContext) -> list[HandlerSpec]:
    store = JsonStore(app.data_root, index_fields=INDEX_LAYOUT)
    service = EntryService(repository=JsonEntryRepository(store))

    # Assinatura dos eventos que preenchem o diario sozinho. O dominio de origem
    # nunca sabe que o Journal existe; o Journal nunca importa o dominio de origem.
    for event_type in (TaskCompleted, GoalReached, DiagramShared):
        app.events.subscribe(event_type, service.on_event)

    return [spec_of(EntryHandler, lambda: EntryHandler(service))]
