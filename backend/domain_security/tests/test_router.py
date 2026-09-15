import threading
from datetime import UTC, datetime

import pytest
from pydantic import BaseModel, ConfigDict

from domain_security.router import Registry, Router
from shared_contracts import (
    ContractError,
    DuplicateFlagError,
    Flag,
    Identity,
    RequestContext,
    UnknownFlagError,
    domain_flag,
    spec_of,
)


class EchoRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    mensagem: str


class EchoResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    mensagem: str
    thread: str


@domain_flag(domain="DEMO", subdomain="SINCRONO", payload=EchoRequest)
class HandlerSincrono:
    """Toca disco: e `def` e o router o joga no threadpool."""

    def handle(self, payload: EchoRequest, context: RequestContext) -> EchoResponse:
        return EchoResponse(mensagem=payload.mensagem, thread=threading.current_thread().name)


@domain_flag(domain="DEMO", subdomain="ASSINCRONO", payload=EchoRequest)
class HandlerAssincrono:
    """Toca rede: e `async def` e o router o aguarda no proprio event loop."""

    async def handle(self, payload: EchoRequest, context: RequestContext) -> EchoResponse:
        return EchoResponse(mensagem=payload.mensagem, thread=threading.current_thread().name)


@pytest.fixture
def context() -> RequestContext:
    return RequestContext(
        request_id="req-1",
        received_at=datetime.now(UTC),
        identity=Identity(user_id="u1", email="m@chiodi.dev"),
    )


@pytest.fixture
def router() -> Router:
    registry = Registry.from_specs(
        [
            spec_of(HandlerSincrono, lambda: HandlerSincrono()),
            spec_of(HandlerAssincrono, lambda: HandlerAssincrono()),
        ]
    )
    return Router(registry=registry)


# ------------------------------------------------------------------- registry


def test_registry_resolve_a_flag_declarada_no_decorador() -> None:
    registry = Registry.from_specs([spec_of(HandlerSincrono, lambda: HandlerSincrono())])
    assert Flag("DEMO", "SINCRONO") in registry


def test_flag_duplicada_explode_no_boot_nunca_em_runtime() -> None:
    spec = spec_of(HandlerSincrono, lambda: HandlerSincrono())
    with pytest.raises(DuplicateFlagError):
        Registry.from_specs([spec, spec])


def test_handler_sem_decorador_e_erro_de_programacao() -> None:
    class SemMarca:
        def handle(self, payload: EchoRequest, context: RequestContext) -> EchoResponse: ...

    with pytest.raises(TypeError):
        spec_of(SemMarca, lambda: SemMarca())


def test_registry_lista_as_flags_conhecidas() -> None:
    registry = Registry.from_specs([spec_of(HandlerSincrono, lambda: HandlerSincrono())])
    assert registry.flags() == (Flag("DEMO", "SINCRONO"),)


# ------------------------------------------------------------------- dispatch


async def test_flag_desconhecida_e_erro_de_contrato_nao_erro_interno(
    router: Router, context: RequestContext
) -> None:
    with pytest.raises(UnknownFlagError) as excinfo:
        await router.dispatch(Flag("DEMO", "FANTASMA"), {}, context)
    assert excinfo.value.status_code == 422


async def test_payload_com_campo_desconhecido_vira_erro_de_contrato(
    router: Router, context: RequestContext
) -> None:
    with pytest.raises(ContractError):
        await router.dispatch(Flag("DEMO", "SINCRONO"), {"mensagem": "oi", "intruso": 1}, context)


async def test_payload_sem_campo_obrigatorio_vira_erro_de_contrato(
    router: Router, context: RequestContext
) -> None:
    with pytest.raises(ContractError):
        await router.dispatch(Flag("DEMO", "SINCRONO"), {}, context)


async def test_handler_sincrono_devolve_o_dto(router: Router, context: RequestContext) -> None:
    resultado = await router.dispatch(Flag("DEMO", "SINCRONO"), {"mensagem": "oi"}, context)
    assert isinstance(resultado, EchoResponse)
    assert resultado.mensagem == "oi"


async def test_handler_assincrono_devolve_o_dto(router: Router, context: RequestContext) -> None:
    resultado = await router.dispatch(Flag("DEMO", "ASSINCRONO"), {"mensagem": "oi"}, context)
    assert resultado.mensagem == "oi"


async def test_handler_sincrono_nao_roda_na_thread_do_event_loop(
    router: Router, context: RequestContext
) -> None:
    """A garantia que impede um `open()` de congelar a aplicacao inteira."""
    resultado = await router.dispatch(Flag("DEMO", "SINCRONO"), {"mensagem": "oi"}, context)
    assert resultado.thread != threading.current_thread().name


async def test_handler_assincrono_roda_na_thread_do_event_loop(
    router: Router, context: RequestContext
) -> None:
    """Chamada de rede nao desperdica thread: ela cede o loop no await."""
    resultado = await router.dispatch(Flag("DEMO", "ASSINCRONO"), {"mensagem": "oi"}, context)
    assert resultado.thread == threading.current_thread().name


async def test_handler_recebe_dto_nunca_dict(router: Router, context: RequestContext) -> None:
    recebido: list[object] = []

    @domain_flag(domain="DEMO", subdomain="ESPIAO", payload=EchoRequest)
    class Espiao:
        def handle(self, payload: EchoRequest, context: RequestContext) -> EchoResponse:
            recebido.append(payload)
            return EchoResponse(mensagem="ok", thread="")

    espiao_router = Router(registry=Registry.from_specs([spec_of(Espiao, lambda: Espiao())]))
    await espiao_router.dispatch(Flag("DEMO", "ESPIAO"), {"mensagem": "oi"}, context)
    assert isinstance(recebido[0], EchoRequest)
    assert not isinstance(recebido[0], dict)


async def test_o_router_resolve_destino_e_nunca_autorizacao(
    router: Router, context: RequestContext
) -> None:
    """Contexto sem identidade chega ao handler: quem barra e o App Security."""
    anonimo = RequestContext(request_id="req-2", received_at=datetime.now(UTC))
    resultado = await router.dispatch(Flag("DEMO", "SINCRONO"), {"mensagem": "oi"}, anonimo)
    assert resultado.mensagem == "oi"
