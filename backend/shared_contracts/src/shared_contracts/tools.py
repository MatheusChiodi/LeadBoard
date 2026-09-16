"""DTOs do dominio Tools: as tres ferramentas que tocam rede (secao 4).

Uma flag por micro-dominio (secao 3): `CEP`, `DNS` e `IP` nao compartilham
payload nem tem mais de uma operacao, entao cada um ganha seu proprio par
Query/Response — sem uniao discriminada, que so se justifica quando o
micro-dominio tem mais de uma operacao (ver `journal.py`).

Validacao de formato mora no DTO, nao no service: um CEP, dominio ou IP mal
formado precisa virar `422` antes de qualquer chamada de rede ser cogitada.
"""

from __future__ import annotations

import ipaddress
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_CEP_DIGITS = 8
_DOMAIN = re.compile(
    r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$"
)


class _Query(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


# --------------------------------------------------------------------------- cep


class CepQuery(_Query):
    cep: str = Field(min_length=1, max_length=9)

    @field_validator("cep")
    @classmethod
    def _normaliza(cls, value: str) -> str:
        digits = "".join(char for char in value if char.isdigit())
        if len(digits) != _CEP_DIGITS:
            raise ValueError(f"CEP deve ter {_CEP_DIGITS} digitos: {value!r}.")
        return digits


class CepResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    cep: str
    logradouro: str
    bairro: str
    localidade: str
    uf: str
    ddd: str


# --------------------------------------------------------------------------- dns

#: Tipos consultados pela ferramenta original, na mesma ordem — agora em
#: paralelo (`asyncio.gather`) em vez de sequencial.
DNS_RECORD_TYPES: tuple[str, ...] = ("A", "AAAA", "MX", "TXT", "CNAME", "NS")


class DnsQuery(_Query):
    domain: str = Field(min_length=1, max_length=253)

    @field_validator("domain")
    @classmethod
    def _valida(cls, value: str) -> str:
        candidate = value.strip().lower()
        if not _DOMAIN.match(candidate):
            raise ValueError(f"Dominio invalido: {value!r}.")
        return candidate


class DnsRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    ttl: int
    data: str


class DnsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    domain: str
    #: Uma entrada por tipo consultado, mesmo quando a tupla vem vazia — o
    #: chamador nao precisa adivinhar quais tipos foram checados.
    records: dict[str, tuple[DnsRecord, ...]]


# ---------------------------------------------------------------------------- ip


class IpQuery(_Query):
    #: Vazio = IP de quem chamou (o proprio backend, ja que a chamada sai daqui).
    ip: str = ""

    @field_validator("ip")
    @classmethod
    def _valida(cls, value: str) -> str:
        candidate = value.strip()
        if candidate and not _e_ip_valido(candidate):
            raise ValueError(f"IP invalido: {value!r}.")
        return candidate


class IpResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    ip: str
    country: str
    region: str
    city: str
    latitude: float
    longitude: float
    asn: int | None
    org: str


def _e_ip_valido(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True
