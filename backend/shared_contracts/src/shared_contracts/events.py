"""Eventos de dominio.

Moram em shared_contracts pelo mesmo motivo do RequestContext: `TaskCompleted` e
produzido por `domain_focus` e consumido por `domain_journal`, e nenhum dos dois
pode importar o outro (principio 3). O evento e o contrato entre eles.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DomainEvent(BaseModel):
    """Fato consumado. Nome no passado, sempre."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    event_id: str
    occurred_at: datetime
    user_id: str


class UserRegistered(DomainEvent):
    email: str


class TaskCompleted(DomainEvent):
    task_id: str
    title: str


class GoalReached(DomainEvent):
    goal_id: str
    title: str


class DiagramShared(DomainEvent):
    diagram_id: str
    title: str
    shared_with: tuple[str, ...]


class ReportPublished(DomainEvent):
    report_id: str
    period_start: str
    period_end: str
    recipients: tuple[str, ...]
