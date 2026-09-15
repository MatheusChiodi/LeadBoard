import httpx
import pytest

from domain_security.httpclient import HttpClient, HttpClientError


def _transport(*respostas: httpx.Response | Exception) -> httpx.MockTransport:
    fila = list(respostas)

    def responder(request: httpx.Request) -> httpx.Response:
        proxima = fila.pop(0) if fila else httpx.Response(200, json={})
        if isinstance(proxima, Exception):
            raise proxima
        return proxima

    return httpx.MockTransport(responder)


async def test_resposta_de_sucesso_devolve_o_json() -> None:
    async with HttpClient(transport=_transport(httpx.Response(200, json={"cep": "01001000"}))) as c:
        assert await c.get_json("https://exemplo.dev/cep") == {"cep": "01001000"}


async def test_status_transitorio_e_repetido_ate_dar_certo() -> None:
    transport = _transport(
        httpx.Response(503), httpx.Response(503), httpx.Response(200, json={"ok": True})
    )
    async with HttpClient(transport=transport, backoff=0) as client:
        assert await client.get_json("https://exemplo.dev") == {"ok": True}


async def test_timeout_e_repetido() -> None:
    transport = _transport(
        httpx.TimeoutException("estourou"), httpx.Response(200, json={"ok": True})
    )
    async with HttpClient(transport=transport, backoff=0) as client:
        assert await client.get_json("https://exemplo.dev") == {"ok": True}


async def test_erro_definitivo_nao_e_repetido() -> None:
    """404 ja esta decidido: repetir so aumenta a latencia do erro."""
    chamadas = 0

    def responder(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas
        chamadas += 1
        return httpx.Response(404)

    async with HttpClient(transport=httpx.MockTransport(responder), backoff=0) as client:
        with pytest.raises(HttpClientError):
            await client.get_json("https://exemplo.dev")
    assert chamadas == 1


async def test_tentativas_esgotadas_viram_erro_do_cliente() -> None:
    transport = _transport(httpx.Response(503), httpx.Response(503), httpx.Response(503))
    async with HttpClient(transport=transport, attempts=3, backoff=0) as client:
        with pytest.raises(HttpClientError, match="status 503"):
            await client.get_json("https://exemplo.dev")


async def test_httpx_nunca_vaza_para_quem_chama() -> None:
    """O dominio consome a porta, nao a biblioteca."""
    transport = _transport(httpx.ConnectError("sem rede"))
    async with HttpClient(transport=transport, attempts=1, backoff=0) as client:
        with pytest.raises(HttpClientError) as excinfo:
            await client.get_json("https://exemplo.dev")
    assert not isinstance(excinfo.value, httpx.HTTPError)


async def test_resposta_que_nao_e_json_vira_erro_do_cliente() -> None:
    transport = _transport(httpx.Response(200, text="<html>erro</html>"))
    async with HttpClient(transport=transport, backoff=0) as client:
        with pytest.raises(HttpClientError, match="JSON"):
            await client.get_json("https://exemplo.dev")


async def test_params_e_headers_chegam_ao_provedor() -> None:
    vistos: dict[str, str] = {}

    def responder(request: httpx.Request) -> httpx.Response:
        vistos["query"] = request.url.query.decode()
        vistos["chave"] = request.headers.get("x-api-key", "")
        return httpx.Response(200, json={})

    async with HttpClient(transport=httpx.MockTransport(responder)) as client:
        await client.get_json(
            "https://exemplo.dev", params={"cep": "01001000"}, headers={"x-api-key": "segredo"}
        )

    assert vistos["query"] == "cep=01001000"
    assert vistos["chave"] == "segredo"
