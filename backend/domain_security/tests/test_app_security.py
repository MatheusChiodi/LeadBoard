from datetime import UTC, datetime, timedelta

import pytest

from domain_security.security import AppSecurity, JwtTokenIssuer, PermissionSource
from shared_contracts import ForbiddenError, UnauthorizedError

SECRET = "segredo-de-teste-com-mais-de-32-bytes-que-nao-vai-para-o-bundle"


class PermissoesFixas:
    """Fake tipado, nao MagicMock: mudanca de assinatura quebra no mypy."""

    def __init__(self, por_usuario: dict[str, frozenset[str]]) -> None:
        self._por_usuario = por_usuario
        self.consultas = 0

    def permissions_for(self, user_id: str) -> frozenset[str]:
        self.consultas += 1
        return self._por_usuario.get(user_id, frozenset())


@pytest.fixture
def issuer() -> JwtTokenIssuer:
    return JwtTokenIssuer(secret=SECRET, ttl=timedelta(hours=1))


@pytest.fixture
def permissoes() -> PermissoesFixas:
    return PermissoesFixas({"u1": frozenset({"draw:share", "journal:write"})})


@pytest.fixture
def security(issuer: JwtTokenIssuer, permissoes: PermissionSource) -> AppSecurity:
    return AppSecurity(issuer=issuer, permissions=permissoes, public_flags={"USER.LOGIN"})


# --------------------------------------------------------------- emissao de token


def test_token_emitido_carrega_identidade(issuer: JwtTokenIssuer) -> None:
    token = issuer.issue("u1", frozenset({"draw:share"}))
    user_id, permissions = issuer.verify(token)
    assert user_id == "u1"
    assert permissions == frozenset({"draw:share"})


def test_segredo_curto_impede_a_aplicacao_de_subir() -> None:
    with pytest.raises(ValueError, match="32 bytes"):
        JwtTokenIssuer(secret="curto-demais", ttl=timedelta(hours=1))


def test_token_com_assinatura_adulterada_e_recusado(issuer: JwtTokenIssuer) -> None:
    token = issuer.issue("u1", frozenset())
    with pytest.raises(UnauthorizedError):
        issuer.verify(token[:-4] + "aaaa")


def test_token_expirado_e_recusado() -> None:
    expirado = JwtTokenIssuer(secret=SECRET, ttl=timedelta(seconds=-10))
    with pytest.raises(UnauthorizedError):
        expirado.verify(expirado.issue("u1", frozenset()))


def test_token_assinado_com_outro_segredo_e_recusado(issuer: JwtTokenIssuer) -> None:
    outro = JwtTokenIssuer(
        secret="um-segredo-bem-diferente-com-tamanho-suficiente", ttl=timedelta(hours=1)
    )
    with pytest.raises(UnauthorizedError):
        issuer.verify(outro.issue("u1", frozenset()))


# ------------------------------------------------------------- resolucao do contexto


def test_rota_publica_segue_sem_identidade(security: AppSecurity) -> None:
    context = security.resolve(flag="USER.LOGIN", authorization=None, request_id="r1")
    assert context.identity is None
    assert not context.is_authenticated


def test_rota_privada_sem_token_morre_no_security(security: AppSecurity) -> None:
    with pytest.raises(UnauthorizedError):
        security.resolve(flag="USER.PROFILE", authorization=None, request_id="r1")


def test_rota_privada_com_token_valido_recebe_identidade(
    security: AppSecurity, issuer: JwtTokenIssuer
) -> None:
    token = issuer.issue("u1", frozenset())
    context = security.resolve(
        flag="USER.PROFILE", authorization=f"Bearer {token}", request_id="r1"
    )
    assert context.identity is not None
    assert context.identity.user_id == "u1"


def test_esquema_de_autorizacao_invalido_e_recusado(
    security: AppSecurity, issuer: JwtTokenIssuer
) -> None:
    token = issuer.issue("u1", frozenset())
    with pytest.raises(UnauthorizedError):
        security.resolve(flag="USER.PROFILE", authorization=f"Basic {token}", request_id="r1")


def test_permissoes_vem_da_fonte_de_verdade_nao_do_token(
    security: AppSecurity, issuer: JwtTokenIssuer, permissoes: PermissoesFixas
) -> None:
    """USER.PERMISSIONS e a fonte de verdade. Token velho nao carrega acesso revogado."""
    token = issuer.issue("u1", frozenset({"acesso:revogado"}))
    context = security.resolve(flag="DRAW.SHARE", authorization=f"Bearer {token}", request_id="r1")
    assert context.identity is not None
    assert context.identity.permissions == frozenset({"draw:share", "journal:write"})
    assert not context.identity.can("acesso:revogado")


def test_permissao_e_consultada_com_cache(
    security: AppSecurity, issuer: JwtTokenIssuer, permissoes: PermissoesFixas
) -> None:
    token = issuer.issue("u1", frozenset())
    for _ in range(5):
        security.resolve(flag="DRAW.SHARE", authorization=f"Bearer {token}", request_id="r1")
    assert permissoes.consultas == 1


def test_contexto_carrega_o_request_id_recebido(
    security: AppSecurity, issuer: JwtTokenIssuer
) -> None:
    token = issuer.issue("u1", frozenset())
    context = security.resolve(
        flag="USER.PROFILE", authorization=f"Bearer {token}", request_id="req-abc"
    )
    assert context.request_id == "req-abc"
    assert context.received_at <= datetime.now(UTC)


# ------------------------------------------------------------------- autorizacao


def test_flag_sem_permissao_morre_no_security_antes_do_router(
    security: AppSecurity, issuer: JwtTokenIssuer
) -> None:
    """Fluxo 7.4: domain_draw nunca chega a saber que aquele diagrama existe."""
    token = issuer.issue("u2", frozenset())
    security.require_permission_for("DRAW.SHARE", "draw:share")
    with pytest.raises(ForbiddenError):
        security.resolve(flag="DRAW.SHARE", authorization=f"Bearer {token}", request_id="r1")


def test_flag_com_permissao_exigida_passa_quando_o_usuario_a_tem(
    security: AppSecurity, issuer: JwtTokenIssuer
) -> None:
    token = issuer.issue("u1", frozenset())
    security.require_permission_for("DRAW.SHARE", "draw:share")
    context = security.resolve(flag="DRAW.SHARE", authorization=f"Bearer {token}", request_id="r1")
    assert context.identity is not None


def test_cache_de_permissao_pode_ser_invalidado(
    security: AppSecurity, issuer: JwtTokenIssuer, permissoes: PermissoesFixas
) -> None:
    token = issuer.issue("u1", frozenset())
    security.resolve(flag="DRAW.SHARE", authorization=f"Bearer {token}", request_id="r1")
    security.invalidate_permissions("u1")
    security.resolve(flag="DRAW.SHARE", authorization=f"Bearer {token}", request_id="r1")
    assert permissoes.consultas == 2
