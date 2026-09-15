"""Dominio Journal: registro do que aconteceu no dia.

Unico dominio do LeadBoard cujo produto final e lido por outra pessoa — e isso
muda o desenho inteiro. O campo `visibility` e o que impede observacao crua de
chegar a gestao por esquecimento.
"""

from domain_journal.registry import handlers

__all__ = ["handlers"]
