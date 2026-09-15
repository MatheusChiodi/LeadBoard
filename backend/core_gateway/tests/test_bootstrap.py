"""Boot de verdade: entry points, registry e app completo.

Os outros testes montam o registry na mao. Este e o unico que exercita a
descoberta real — se o entry point do `pyproject.toml` estiver com o nome errado,
so ele acusa, e acusa antes de virar uma flag que some em producao.
"""

from __future__ import annotations

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


def test_segredo_ausente_impede_a_subida(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default embutido seria segredo publicado: quem clona o repo assina token."""
    monkeypatch.delenv("LEADBOARD_JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="LEADBOARD_JWT_SECRET"):
        Settings.from_env()


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
