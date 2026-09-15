"""Barramento de eventos em processo.

O barramento e injetado como Protocol (`EventBus`), nunca importado direto de uma
implementacao. Esta versao serve para o comeco; quando a entrega precisar ser
garantida, a troca acontece dentro do adapter, sem tocar em um unico service.
"""

from __future__ import annotations

import logging
import threading
from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable

    from shared_contracts import DomainEvent

logger = logging.getLogger("leadboard.bus")


class InProcessEventBus:
    """Entrega sincrona, no mesmo processo.

    Limite conhecido e aceito: evento publicado some se o processo morrer antes da
    entrega. Para `UserRegistered` isso significa um e-mail de boas-vindas perdido,
    nao um cadastro perdido — o cadastro ja foi persistido antes da publicacao. E
    exatamente por isso que o fluxo 7.3 publica evento em vez de enviar o e-mail
    ali mesmo.
    """

    def __init__(self) -> None:
        self._guard = threading.Lock()
        self._subscribers: dict[type[DomainEvent], list[Callable[[DomainEvent], None]]] = (
            defaultdict(list)
        )

    def subscribe(
        self, event_type: type[DomainEvent], handler: Callable[[DomainEvent], None]
    ) -> None:
        with self._guard:
            self._subscribers[event_type].append(handler)

    def publish(self, event: DomainEvent) -> None:
        """Falha de assinante nunca derruba quem publicou.

        O fluxo 7.3 depende disso: falha no Notify nao pode derrubar o cadastro.
        Se um assinante explodir e a excecao subisse, o service que acabou de
        persistir receberia o erro de um efeito colateral que ja nao e problema
        dele.
        """
        with self._guard:
            handlers = list(self._subscribers.get(type(event), ()))

        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception(
                    "Assinante falhou ao tratar %s (%s)",
                    type(event).__name__,
                    event.event_id,
                )
