"""Hierarquia de erros de contrato.

Cada erro carrega o codigo HTTP que o gateway usa para traduzi-lo. Isso mantem
o mapeamento em um lugar so: dominio levanta erro de dominio, nunca HTTPException.
"""

from __future__ import annotations


class LeadBoardError(Exception):
    """Raiz de tudo que o sistema levanta de proposito."""

    status_code: int = 500


class ContractError(LeadBoardError):
    """Entrada nao respeita o contrato declarado."""

    status_code = 422


class InvalidFlagError(ContractError):
    def __init__(self, raw: str) -> None:
        super().__init__(f"Flag invalida: {raw!r}. Formato esperado DOMINIO.SUBDOMINIO.")
        self.raw = raw


class UnknownFlagError(ContractError):
    """Flag bem formada, sem handler registrado. Nunca vira 500."""

    def __init__(self, flag: object) -> None:
        super().__init__(f"Nenhum handler registrado para a flag {flag}.")
        self.flag = flag


class DuplicateFlagError(LeadBoardError):
    """Duas implementacoes disputam a mesma flag. Explode no boot, nunca em runtime."""

    def __init__(self, flag: object) -> None:
        super().__init__(f"Flag {flag} registrada mais de uma vez.")
        self.flag = flag


class UnauthorizedError(LeadBoardError):
    status_code = 401


class ForbiddenError(LeadBoardError):
    status_code = 403


class NotFoundError(LeadBoardError):
    status_code = 404


class VersionConflictError(LeadBoardError):
    """Versao otimista divergente: o agregado mudou desde a leitura."""

    status_code = 409

    def __init__(self, expected: int, actual: int) -> None:
        super().__init__(f"Versao esperada {expected}, encontrada {actual}.")
        self.expected = expected
        self.actual = actual
