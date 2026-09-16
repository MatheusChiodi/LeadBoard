"""Ponto de entrada do dominio tools.

Publicado como entry point `leadboard.handlers`. O core chama esta funcao sem
importar `domain_tools` por nome — e e isso que mantem a regra de dependencia intacta.

Unico lugar do dominio onde a composicao acontece: o AppContext entra uma vez,
aqui, e sai como factories ja ligadas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from domain_tools.cep.handler import CepHandler
from domain_tools.cep.service import CepService
from domain_tools.dns.handler import DnsHandler
from domain_tools.dns.service import DnsService
from domain_tools.ip.handler import IpHandler
from domain_tools.ip.service import IpService
from shared_contracts import spec_of

if TYPE_CHECKING:
    from shared_contracts import AppContext, HandlerSpec


def handlers(app: AppContext) -> list[HandlerSpec]:
    cep_service = CepService(app.http)
    dns_service = DnsService(app.http)
    ip_service = IpService(app.http)

    return [
        spec_of(CepHandler, lambda: CepHandler(cep_service)),
        spec_of(DnsHandler, lambda: DnsHandler(dns_service)),
        spec_of(IpHandler, lambda: IpHandler(ip_service)),
    ]
