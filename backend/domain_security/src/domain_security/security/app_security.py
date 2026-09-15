"""App Security: resolve identidade e permissao antes de qualquer regra rodar.

Request sem identidade valida morre aqui. Autorizacao tambem: o dominio de
negocio jamais recebe uma request que nao deveria executar (fluxo 7.4).
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from shared_contracts import ForbiddenError, Identity, RequestContext, UnauthorizedError

if TYPE_CHECKING:
    from collections.abc import Iterable

    from shared_contracts import TokenIssuer

BEARER_PREFIX = "Bearer "


@runtime_checkable
class PermissionSource(Protocol):
    """Porta para USER.PERMISSIONS, a fonte de verdade das permissoes.

    O App Security consome por contrato, com cache, e nunca importa domain_user.
    """

    def permissions_for(self, user_id: str) -> frozenset[str]: ...


class AppSecurity:
    """Primeira etapa obrigatoria do Security. Roda antes do App Router, sempre.

    E uma dependencia do FastAPI (`Depends`), nao um middleware solto: dependencia
    e testavel isoladamente e declara o que devolve.
    """

    def __init__(
        self,
        *,
        issuer: TokenIssuer,
        permissions: PermissionSource,
        public_flags: Iterable[str] = (),
    ) -> None:
        self._issuer = issuer
        self._permissions = permissions
        self._public_flags = {flag.upper() for flag in public_flags}
        self._required: dict[str, str] = {}
        self._cache: dict[str, frozenset[str]] = {}
        self._cache_guard = threading.Lock()

    # ------------------------------------------------------------------ politica

    def require_permission_for(self, flag: str, permission: str) -> None:
        """Declara que uma flag exige permissao. Configuracao de boot, nao de request."""
        self._required[flag.upper()] = permission

    def invalidate_permissions(self, user_id: str) -> None:
        """Chamado quando USER.PERMISSIONS muda. Sem isso o cache mente ate reiniciar."""
        with self._cache_guard:
            self._cache.pop(user_id, None)

    # ------------------------------------------------------------------ resolucao

    def resolve(self, *, flag: str, authorization: str | None, request_id: str) -> RequestContext:
        normalized = flag.upper()
        received_at = datetime.now(UTC)

        if normalized in self._public_flags and authorization is None:
            return RequestContext(request_id=request_id, received_at=received_at)

        user_id, _ = self._issuer.verify(_extract_token(authorization))
        identity = Identity(
            user_id=user_id,
            email="",
            permissions=self._permissions_of(user_id),
        )

        required = self._required.get(normalized)
        if required is not None and not identity.can(required):
            raise ForbiddenError(f"Identidade {user_id} nao tem permissao para {normalized}.")

        return RequestContext(request_id=request_id, received_at=received_at, identity=identity)

    # ------------------------------------------------------------------- interno

    def _permissions_of(self, user_id: str) -> frozenset[str]:
        """Cache primeiro; a fonte de verdade e o ultimo recurso (fluxo 7.2)."""
        with self._cache_guard:
            cached = self._cache.get(user_id)
            if cached is not None:
                return cached
        resolved = self._permissions.permissions_for(user_id)
        with self._cache_guard:
            self._cache[user_id] = resolved
        return resolved


def _extract_token(authorization: str | None) -> str:
    if authorization is None or not authorization.startswith(BEARER_PREFIX):
        raise UnauthorizedError("Credencial ausente ou em esquema nao suportado.")
    token = authorization[len(BEARER_PREFIX) :].strip()
    if not token:
        raise UnauthorizedError("Credencial vazia.")
    return token
