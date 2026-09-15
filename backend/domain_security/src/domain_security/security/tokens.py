"""Emissao e verificacao de token.

Implementa o `TokenIssuer` de shared_contracts. E o que permite `USER.LOGIN`
verificar a credencial e PEDIR a emissao do token, sem assinar nada por conta
propria e sem importar este pacote.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt

from shared_contracts import UnauthorizedError

ALGORITHM = "HS256"
MIN_SECRET_BYTES = 32


class JwtTokenIssuer:
    """Unico ponto do sistema que assina e valida token.

    O segredo entra por parametro, nunca por leitura de ambiente aqui dentro:
    construtor que le `os.environ` e teste que depende de variavel global.
    """

    def __init__(self, *, secret: str, ttl: timedelta) -> None:
        # HS256 com segredo curto e forca bruta viavel. A RFC 7518 3.2 exige chave
        # de pelo menos o tamanho do digest — recusar no construtor e o que impede
        # o sistema de subir com um segredo fraco em vez de so avisar em log.
        if len(secret.encode("utf-8")) < MIN_SECRET_BYTES:
            raise ValueError(f"Segredo de assinatura precisa de ao menos {MIN_SECRET_BYTES} bytes.")
        self._secret = secret
        self._ttl = ttl

    def issue(self, user_id: str, permissions: frozenset[str]) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": user_id,
            "perms": sorted(permissions),
            "iat": int(now.timestamp()),
            "exp": int((now + self._ttl).timestamp()),
        }
        return jwt.encode(payload, self._secret, algorithm=ALGORITHM)

    def verify(self, token: str) -> tuple[str, frozenset[str]]:
        """Devolve identidade e permissoes gravadas no token.

        As permissoes daqui sao um retrato do momento da emissao. Quem decide
        acesso e o AppSecurity, consultando a fonte de verdade — senao um token
        de uma hora atras continuaria valendo depois de um acesso revogado.
        """
        try:
            payload = jwt.decode(token, self._secret, algorithms=[ALGORITHM])
        except jwt.PyJWTError as exc:
            raise UnauthorizedError("Token invalido ou expirado.") from exc

        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            raise UnauthorizedError("Token sem identidade.")

        raw_permissions = payload.get("perms", [])
        permissions = (
            frozenset(str(item) for item in raw_permissions)
            if isinstance(raw_permissions, list)
            else frozenset()
        )
        return subject, permissions
