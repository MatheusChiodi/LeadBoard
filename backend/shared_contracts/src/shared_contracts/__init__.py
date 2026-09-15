"""Contratos compartilhados do LeadBoard.

Regra que sustenta o principio 3: este pacote nao importa NINGUEM. Todo tipo que
aparece na assinatura de um contrato entre dominios mora aqui — nunca no pacote
de quem o produz.
"""

from shared_contracts.context import Identity, RequestContext
from shared_contracts.errors import (
    ContractError,
    DuplicateFlagError,
    ForbiddenError,
    InvalidFlagError,
    LeadBoardError,
    NotFoundError,
    UnauthorizedError,
    UnknownFlagError,
    VersionConflictError,
)
from shared_contracts.events import (
    DiagramShared,
    DomainEvent,
    GoalReached,
    ReportPublished,
    TaskCompleted,
    UserRegistered,
)
from shared_contracts.flag import Flag
from shared_contracts.handler import (
    AsyncDomainHandler,
    DomainHandler,
    HandlerFactory,
    HandlerSpec,
    SyncDomainHandler,
    domain_flag,
    spec_of,
)
from shared_contracts.journal import (
    ConfirmEntry,
    CreateEntry,
    DeleteEntry,
    EntryCommand,
    EntryDeletedResponse,
    EntryListResponse,
    EntryResponse,
    EntrySource,
    EntryStatus,
    GetEntry,
    ListEntries,
    PromoteEntry,
    UpdateEntry,
    Visibility,
)
from shared_contracts.ports import AppContext, Clock, EventBus, HttpPort, TokenIssuer

__all__ = [
    "AppContext",
    "AsyncDomainHandler",
    "Clock",
    "ConfirmEntry",
    "ContractError",
    "CreateEntry",
    "DeleteEntry",
    "DiagramShared",
    "DomainEvent",
    "DomainHandler",
    "DuplicateFlagError",
    "EntryCommand",
    "EntryDeletedResponse",
    "EntryListResponse",
    "EntryResponse",
    "EntrySource",
    "EntryStatus",
    "EventBus",
    "Flag",
    "ForbiddenError",
    "GetEntry",
    "GoalReached",
    "HandlerFactory",
    "HandlerSpec",
    "HttpPort",
    "Identity",
    "InvalidFlagError",
    "LeadBoardError",
    "ListEntries",
    "NotFoundError",
    "PromoteEntry",
    "ReportPublished",
    "RequestContext",
    "SyncDomainHandler",
    "TaskCompleted",
    "TokenIssuer",
    "UnauthorizedError",
    "UnknownFlagError",
    "UpdateEntry",
    "UserRegistered",
    "VersionConflictError",
    "Visibility",
    "domain_flag",
    "spec_of",
]
