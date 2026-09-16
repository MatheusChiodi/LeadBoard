"""Boot de verdade: entry points, registry e app completo.

Os outros testes montam o registry na mao. Este e o unico que exercita a
descoberta real — se o entry point do `pyproject.toml` estiver com o nome errado,
so ele acusa, e acusa antes de virar uma flag que some em producao.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import timedelta
from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient

from core_gateway.bootstrap import LeadBoardContext, NoPermissions, Settings, build_app
from core_gateway.bus import InProcessEventBus
from domain_security import HttpClient, JwtTokenIssuer, Registry
from shared_contracts import Flag

if TYPE_CHECKING:
    from pathlib import Path

SECRET = "segredo-de-teste-com-mais-de-32-bytes-para-o-bootstrap"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_root=tmp_path,
        jwt_secret=SECRET,
        token_ttl=timedelta(hours=1),
        http_timeout=1.0,
    )


def _context(tmp_path: Path) -> LeadBoardContext:
    return LeadBoardContext(
        data_root=tmp_path,
        events=InProcessEventBus(),
        http=HttpClient(),
        tokens=JwtTokenIssuer(secret=SECRET, ttl=timedelta(hours=1)),
    )


def test_registry_descobre_o_dominio_pelo_entry_point(tmp_path: Path) -> None:
    """`core` nunca faz `import domain_journal`. Ele le o que foi anunciado."""
    registry = Registry.discover(_context(tmp_path))
    assert Flag("JOURNAL", "ENTRY") in registry


def test_boot_monta_o_app_inteiro(settings: Settings) -> None:
    app = build_app(settings)
    rotas = {rota.path for rota in app.routes}  # type: ignore[attr-defined]
    assert "/api/dispatch" in rotas


def test_segredo_ausente_impede_a_subida_quando_ha_login(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Default embutido seria segredo publicado: quem clona o repo assina token."""
    monkeypatch.delenv("LEADBOARD_JWT_SECRET", raising=False)
    monkeypatch.setenv("LEADBOARD_SINGLE_USER", "")
    with pytest.raises(RuntimeError, match="LEADBOARD_JWT_SECRET"):
        Settings.from_env()


def test_modo_usuario_unico_dispensa_segredo(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sem login nenhum token e emitido; exigir segredo seria atrito por nada."""
    monkeypatch.delenv("LEADBOARD_JWT_SECRET", raising=False)
    monkeypatch.delenv("LEADBOARD_SINGLE_USER", raising=False)
    resolved = Settings.from_env()
    assert resolved.single_user_id == "local"
    assert len(resolved.jwt_secret) >= 32


def test_settings_lidas_do_ambiente(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("LEADBOARD_JWT_SECRET", SECRET)
    monkeypatch.setenv("LEADBOARD_DATA_ROOT", str(tmp_path))
    monkeypatch.setenv("LEADBOARD_TOKEN_HOURS", "3")
    resolved = Settings.from_env()
    assert resolved.data_root == tmp_path
    assert resolved.token_ttl == timedelta(hours=3)


async def test_request_real_de_ponta_a_ponta(settings: Settings) -> None:
    """Do header HTTP ate o arquivo em disco, pelo app montado no boot."""
    app = build_app(settings)
    issuer = JwtTokenIssuer(secret=SECRET, ttl=timedelta(hours=1))
    headers = {
        "X-Domain-Flag": "JOURNAL.ENTRY",
        "Authorization": f"Bearer {issuer.issue('u1', frozenset())}",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        criada = await client.post(
            "/api/dispatch",
            headers=headers,
            json={"op": "create", "title": "primeiro dia", "occurred_on": "2026-09-15"},
        )

    assert criada.status_code == 200
    gravados = list((settings.data_root / "journal" / "entry" / "2026-09").glob("*.json"))
    assert len(gravados) == 1
    assert "primeiro dia" in gravados[0].read_text(encoding="utf-8")


def test_permissoes_ausentes_falham_fechado(tmp_path: Path) -> None:
    """Enquanto USER.PERMISSIONS nao existe, identidade nao ganha acesso nenhum."""
    assert NoPermissions().permissions_for("u1") == frozenset()


async def test_sem_login_a_request_passa_sem_credencial(settings: Settings) -> None:
    """Enquanto USER.LOGIN nao existe, o produto inteiro precisa funcionar."""
    app = build_app(settings)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resposta = await client.post(
            "/api/dispatch",
            headers={"X-Domain-Flag": "JOURNAL.ENTRY"},
            json={"op": "create", "title": "sem login", "occurred_on": "2026-09-15"},
        )
    assert resposta.status_code == 200


async def test_com_login_ligado_a_request_sem_credencial_morre(settings: Settings) -> None:
    """A mesma request volta a dar 401 assim que o modo usuario unico sai.

    Nenhum dominio muda: a alteracao e uma linha de configuracao do Security.
    """
    app = build_app(replace(settings, single_user_id=None))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resposta = await client.post(
            "/api/dispatch",
            headers={"X-Domain-Flag": "JOURNAL.ENTRY"},
            json={"op": "list", "start": "2026-09-01", "end": "2026-09-30"},
        )
    assert resposta.status_code == 401


async def test_entrada_criada_sem_login_pertence_ao_usuario_local(settings: Settings) -> None:
    app = build_app(settings)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/dispatch",
            headers={"X-Domain-Flag": "JOURNAL.ENTRY"},
            json={"op": "create", "title": "minha", "occurred_on": "2026-09-15"},
        )
    gravado = next((settings.data_root / "journal" / "entry" / "2026-09").glob("*.json"))
    assert '"author_id": "local"' in gravado.read_text(encoding="utf-8")
