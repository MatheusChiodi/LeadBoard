"""API Gateway: entrada unica.

O gateway nao conhece dominio nenhum. Ele conhece `Flag`, `RequestContext` e o
router — e e por isso que dominio novo nunca o obriga a mudar.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Annotated
from uuid import uuid4

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse

from shared_contracts import ContractError, Flag, LeadBoardError

if TYPE_CHECKING:
    from starlette.types import Lifespan

    from domain_security import AppSecurity, Router

logger = logging.getLogger("leadboard.gateway")

DISPATCH_PATH = "/api/dispatch"
HEALTH_PATH = "/api/health"
REQUEST_ID_HEADER = "X-Request-Id"
FLAG_HEADER = "X-Domain-Flag"


def create_app(
    *,
    router: Router,
    security: AppSecurity,
    lifespan: Lifespan[FastAPI] | None = None,
) -> FastAPI:
    """Monta o app com as dependencias ja resolvidas.

    Router e AppSecurity entram por parametro, nunca por import de um singleton:
    e o que permite o teste de integracao subir o app inteiro em memoria com um
    registry de tres handlers falsos.
    """
    app = FastAPI(
        title="LeadBoard",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    @app.get(HEALTH_PATH)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(DISPATCH_PATH)
    async def dispatch(
        request: Request,
        raw_flag: Annotated[str, Header(alias=FLAG_HEADER)],
        authorization: Annotated[str | None, Header()] = None,
    ) -> JSONResponse:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid4().hex
        flag_label = raw_flag

        try:
            flag = Flag.parse(raw_flag)
            flag_label = str(flag)
            context = security.resolve(
                flag=flag_label, authorization=authorization, request_id=request_id
            )
            payload = await _read_payload(request)
            result = await router.dispatch(flag, payload, context)
        except LeadBoardError as exc:
            return _failure(exc.status_code, str(exc), flag_label, request_id)
        except Exception:
            # Mensagem de excecao inesperada pode carregar caminho de arquivo,
            # trecho de query ou valor de campo. O cliente recebe so o request id;
            # o detalhe fica no log, onde e util e nao e publico.
            logger.exception("Falha inesperada em %s (request %s)", flag_label, request_id)
            return _failure(500, "Erro interno.", flag_label, request_id)

        return JSONResponse(
            status_code=200,
            content=result.model_dump(mode="json"),
            headers={REQUEST_ID_HEADER: request_id},
        )

    return app


async def _read_payload(request: Request) -> dict[str, object]:
    """Corpo ausente ou vazio vale como objeto vazio; corpo malformado e 422."""
    body = await request.body()
    if not body.strip():
        return {}
    try:
        parsed = await request.json()
    except ValueError as exc:
        raise ContractError("Corpo da request nao e JSON valido.") from exc
    if not isinstance(parsed, dict):
        raise ContractError("Corpo da request precisa ser um objeto JSON.")
    return parsed


def _failure(status: int, detail: str, flag: str, request_id: str) -> JSONResponse:
    """Toda resposta de erro carrega flag e request id.

    Com uma unica URL para o sistema inteiro, `/api/dispatch` no log nao diz nada.
    A flag e o que da observabilidade por caso de uso, e o request id e o que liga
    a reclamacao do usuario a linha de log.
    """
    return JSONResponse(
        status_code=status,
        content={"detail": detail, "flag": flag, "request_id": request_id},
        headers={REQUEST_ID_HEADER: request_id},
    )
