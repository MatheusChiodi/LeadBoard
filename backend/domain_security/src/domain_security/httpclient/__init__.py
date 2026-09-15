"""Http Client: unica saida para a rede. Nenhum dominio instancia cliente proprio."""

from domain_security.httpclient.client import (
    DEFAULT_ATTEMPTS,
    DEFAULT_TIMEOUT_SECONDS,
    HttpClient,
    HttpClientError,
)

__all__ = ["DEFAULT_ATTEMPTS", "DEFAULT_TIMEOUT_SECONDS", "HttpClient", "HttpClientError"]
