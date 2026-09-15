"""Handler de JOURNAL.ENTRY.

Ele valida o contrato de entrada e delega. Nenhuma decisao acontece aqui — regra
de negocio em handler e bloqueio de merge (principio 4).

E `def`, nao `async def`: toca disco pelo repository, e o router o executa no
threadpool. `async def` com `open()` dentro travaria o event loop inteiro.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_never

from shared_contracts import (
    ConfirmEntry,
    CreateEntry,
    DeleteEntry,
    EntryCommand,
    EntryDeletedResponse,
    GetEntry,
    ListEntries,
    PromoteEntry,
    UpdateEntry,
    domain_flag,
)

if TYPE_CHECKING:
    from pydantic import BaseModel

    from domain_journal.entry.service import EntryService
    from shared_contracts import RequestContext


@domain_flag(domain="JOURNAL", subdomain="ENTRY", payload=EntryCommand)
class EntryHandler:
    def __init__(self, service: EntryService) -> None:
        self._service = service

    def handle(self, payload: EntryCommand, context: RequestContext) -> BaseModel:
        """Despacho por tipo de comando.

        `assert_never` no ramo final faz o mypy falhar se alguem adicionar um
        comando a uniao e esquecer de trata-lo aqui — o equivalente ao `sealed`
        que o Java daria de graca.
        """
        command = payload.root
        identity = context.require_identity()

        match command:
            case CreateEntry():
                return self._service.create(command, user_id=identity.user_id)
            case UpdateEntry():
                return self._service.update(command)
            case PromoteEntry():
                return self._service.promote(command)
            case ConfirmEntry():
                return self._service.confirm(command)
            case ListEntries():
                return self._service.list(command)
            case GetEntry():
                return self._service.get(command)
            case DeleteEntry():
                self._service.delete(command)
                return EntryDeletedResponse(id=command.entry_id)
            case _:
                assert_never(command)
