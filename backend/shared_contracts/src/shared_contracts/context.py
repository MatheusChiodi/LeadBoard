"""RequestContext mora aqui, e nao em domain_security, por uma razao de fronteira.

Todo handler de negocio recebe o contexto na assinatura. Se o tipo vivesse no
pacote de quem o produz (o Security), todo dominio precisaria importar
`domain_security` — quebrando o principio 3. Contrato compartilhado fica no
pacote mais neutro da arvore, nunca no pacote do produtor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True, slots=True)
class Identity:
    user_id: str
    email: str
    permissions: frozenset[str] = field(default_factory=frozenset)

    def can(self, permission: str) -> bool:
        return permission in self.permissions


@dataclass(frozen=True, slots=True)
class RequestContext:
    """O que o App Security resolveu antes de qualquer regra de negocio rodar."""

    request_id: str
    received_at: datetime
    identity: Identity | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.identity is not None

    def require_identity(self) -> Identity:
        from shared_contracts.errors import UnauthorizedError

        if self.identity is None:
            raise UnauthorizedError("Request sem identidade valida.")
        return self.identity
