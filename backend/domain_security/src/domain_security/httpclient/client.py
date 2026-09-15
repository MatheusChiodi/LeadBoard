"""Http Client: unica saida para a rede.

Nenhum dominio instancia cliente proprio. Chamada a terceiro sai por aqui, com
timeout, politica de retry e chave de API que nao pode existir em bundle de
frontend — navegador falando direto com o provedor e CORS quebrado hoje e chave
vazada amanha.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from collections.abc import Mapping
    from types import TracebackType

DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_ATTEMPTS = 3
DEFAULT_BACKOFF_SECONDS = 0.2
RETRIABLE_STATUS = frozenset({429, 502, 503, 504})


class HttpClientError(Exception):
    """Falha de saida externa. Nunca vaza httpx para o dominio."""

    def __init__(self, url: str, reason: str) -> None:
        super().__init__(f"Falha ao chamar {url}: {reason}")
        self.url = url
        self.reason = reason


class HttpClient:
    """Um `httpx.AsyncClient` unico, compartilhado pelo processo.

    Cliente por chamada refaz handshake TLS toda vez e estoura o limite de
    descritores sob carga. O pool de conexoes so existe se o cliente sobreviver
    entre requests.
    """

    def __init__(
        self,
        *,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        attempts: int = DEFAULT_ATTEMPTS,
        backoff: float = DEFAULT_BACKOFF_SECONDS,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._attempts = max(1, attempts)
        self._backoff = backoff
        self._client = httpx.AsyncClient(timeout=timeout, transport=transport)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> HttpClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def get_json(
        self,
        url: str,
        *,
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> object:
        """GET com retry apenas no que e seguro repetir.

        Timeout, erro de conexao e 429/502/503/504 sao transitorios. 404 e 400 nao
        sao: repetir so aumenta a latencia do erro que ja esta decidido.
        """
        delay = self._backoff
        last_reason = "sem tentativa"

        for attempt in range(self._attempts):
            try:
                response = await self._client.get(
                    url, params=dict(params or {}), headers=dict(headers or {})
                )
            except httpx.TimeoutException:
                last_reason = "timeout"
            except httpx.HTTPError as exc:
                last_reason = f"erro de transporte: {exc}"
            else:
                if response.status_code in RETRIABLE_STATUS:
                    last_reason = f"status {response.status_code}"
                elif response.is_success:
                    return _decode(url, response)
                else:
                    raise HttpClientError(url, f"status {response.status_code}")

            if attempt < self._attempts - 1:
                await asyncio.sleep(delay)
                delay *= 2

        raise HttpClientError(url, last_reason)


def _decode(url: str, response: httpx.Response) -> object:
    try:
        return response.json()
    except ValueError as exc:
        raise HttpClientError(url, "resposta nao e JSON valido") from exc
