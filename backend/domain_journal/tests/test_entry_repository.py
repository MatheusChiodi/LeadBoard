"""Bateria de contrato do EntryRepository.

Nenhum teste desta classe conhece arquivo ou SQL. Ela roda hoje contra o
`JsonEntryRepository` e, no dia em que existir um `SqlEntryRepository`, roda
contra ele sem alterar uma linha.

Se um teste precisar saber que existe arquivo, ele esta no lugar errado: vai para
a suite do `JsonStore`, junto com escrita atomica, lock e indice.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

import pytest

from domain_journal.entry import COLLECTION, INDEX_FIELDS, JsonEntryRepository
from domain_journal.entry.models import Entry
from shared_contracts import (
    EntrySource,
    EntryStatus,
    NotFoundError,
    VersionConflictError,
    Visibility,
)
from shared_storage import JsonStore

if TYPE_CHECKING:
    from pathlib import Path

    from domain_journal.entry.repository import EntryRepository

MOMENT = datetime(2026, 9, 15, 10, 30, tzinfo=UTC)


def _entry(entry_id: str, *, dia: int = 15, mes: int = 9, **extra: object) -> Entry:
    base = {
        "author_id": "u1",
        "title": "incidente no deploy",
        "body": "o pipeline quebrou no passo de migracao",
        "occurred_on": date(2026, mes, dia),
        "tags": ("incidente",),
        "visibility": Visibility.PRIVATE,
        "status": EntryStatus.CONFIRMED,
        "source": EntrySource.MANUAL,
        "version": 0,
        "created_at": MOMENT,
        "updated_at": MOMENT,
    }
    base.update(extra)
    return Entry(id=entry_id, **base)  # type: ignore[arg-type]


class EntryRepositoryContract:
    """Herdado por cada implementacao."""

    @pytest.fixture
    def repository(self) -> EntryRepository:
        raise NotImplementedError

    def test_salva_e_recupera(self, repository: EntryRepository) -> None:
        salvo = repository.save(_entry("01A"), expected_version=None)
        recuperado = repository.get("01A")
        assert recuperado is not None
        assert recuperado.title == salvo.title

    def test_id_inexistente_devolve_none(self, repository: EntryRepository) -> None:
        assert repository.get("nao-existe") is None

    def test_primeira_gravacao_nasce_na_versao_um(self, repository: EntryRepository) -> None:
        assert repository.save(_entry("01A"), expected_version=None).version == 1

    def test_gravacao_seguinte_incrementa_a_versao(self, repository: EntryRepository) -> None:
        salvo = repository.save(_entry("01A"), expected_version=None)
        atualizado = repository.save(
            salvo.edited(title="corrigido", body=None, tags=None, at=MOMENT),
            expected_version=salvo.version,
        )
        assert atualizado.version == 2
        assert atualizado.title == "corrigido"

    def test_versao_divergente_levanta_conflito(self, repository: EntryRepository) -> None:
        salvo = repository.save(_entry("01A"), expected_version=None)
        with pytest.raises(VersionConflictError):
            repository.save(salvo, expected_version=99)

    def test_atualizar_entrada_inexistente_e_not_found(self, repository: EntryRepository) -> None:
        with pytest.raises(NotFoundError):
            repository.save(_entry("fantasma"), expected_version=1)

    def test_periodo_filtra_pelas_bordas(self, repository: EntryRepository) -> None:
        for indice, dia in enumerate((14, 15, 16)):
            repository.save(_entry(f"01{indice}", dia=dia), expected_version=None)
        encontrados = repository.list_by_period(date(2026, 9, 15), date(2026, 9, 15))
        assert [item.occurred_on.day for item in encontrados] == [15]

    def test_periodo_atravessa_meses(self, repository: EntryRepository) -> None:
        repository.save(_entry("01A", mes=9, dia=30), expected_version=None)
        repository.save(_entry("01B", mes=10, dia=1), expected_version=None)
        encontrados = repository.list_by_period(date(2026, 9, 1), date(2026, 10, 31))
        assert len(encontrados) == 2

    def test_periodo_vazio_devolve_lista_vazia(self, repository: EntryRepository) -> None:
        assert repository.list_by_period(date(2020, 1, 1), date(2020, 1, 31)) == []

    def test_filtro_por_tag(self, repository: EntryRepository) -> None:
        repository.save(_entry("01A", tags=("incidente",)), expected_version=None)
        repository.save(_entry("01B", tags=("rotina",)), expected_version=None)
        encontrados = repository.list_by_period(
            date(2026, 9, 1), date(2026, 9, 30), tags=("rotina",)
        )
        assert [item.id for item in encontrados] == ["01B"]

    def test_listagem_vem_ordenada_por_data_e_id(self, repository: EntryRepository) -> None:
        repository.save(_entry("01C", dia=16), expected_version=None)
        repository.save(_entry("01A", dia=14), expected_version=None)
        repository.save(_entry("01B", dia=15), expected_version=None)
        encontrados = repository.list_by_period(date(2026, 9, 1), date(2026, 9, 30))
        assert [item.id for item in encontrados] == ["01A", "01B", "01C"]

    def test_delete_remove(self, repository: EntryRepository) -> None:
        repository.save(_entry("01A"), expected_version=None)
        repository.delete("01A")
        assert repository.get("01A") is None

    def test_delete_de_inexistente_nao_explode(self, repository: EntryRepository) -> None:
        repository.delete("fantasma")

    def test_visibilidade_sobrevive_a_ida_e_volta(self, repository: EntryRepository) -> None:
        """Se `visibility` se perdesse na serializacao, o default do Pydantic
        poderia devolver PRIVATE — mascarando o defeito — ou pior."""
        repository.save(_entry("01A", visibility=Visibility.REPORTABLE), expected_version=None)
        recuperado = repository.get("01A")
        assert recuperado is not None
        assert recuperado.visibility is Visibility.REPORTABLE

    def test_todos_os_campos_sobrevivem_a_ida_e_volta(self, repository: EntryRepository) -> None:
        original = _entry(
            "01A",
            status=EntryStatus.DRAFT,
            source=EntrySource.EVENT,
            origin_event_id="evento-1",
        )
        repository.save(original, expected_version=None)
        recuperado = repository.get("01A")
        assert recuperado is not None
        assert recuperado.status is EntryStatus.DRAFT
        assert recuperado.source is EntrySource.EVENT
        assert recuperado.origin_event_id == "evento-1"
        assert recuperado.tags == original.tags
        assert recuperado.body == original.body


class TestJsonEntryRepository(EntryRepositoryContract):
    @pytest.fixture
    def repository(self, tmp_path: Path) -> EntryRepository:
        return JsonEntryRepository(JsonStore(tmp_path, index_fields={COLLECTION: INDEX_FIELDS}))


class TestEmMemoriaCumpreOMesmoContrato(EntryRepositoryContract):
    """Segunda implementacao, hoje, so para provar que o contrato nao vazou disco.

    Se algum teste da bateria acima soubesse de arquivo, esta classe quebraria —
    e e exatamente esse sinal que a bateria existe para dar antes de alguem
    escrever a versao SQL.
    """

    @pytest.fixture
    def repository(self) -> EntryRepository:
        return _RepositorioEmMemoria()


class _RepositorioEmMemoria:
    def __init__(self) -> None:
        self._itens: dict[str, Entry] = {}

    def get(self, entry_id: str) -> Entry | None:
        return self._itens.get(entry_id)

    def list_by_period(self, start: date, end: date, *, tags: tuple[str, ...] = ()) -> list[Entry]:
        wanted = set(tags)
        found = [
            item
            for item in self._itens.values()
            if start <= item.occurred_on <= end and (not wanted or wanted & set(item.tags))
        ]
        return sorted(found, key=lambda item: (item.occurred_on, item.id))

    def save(self, entry: Entry, expected_version: int | None) -> Entry:
        atual = self._itens.get(entry.id)
        if expected_version is None:
            if atual is not None:
                raise VersionConflictError(0, atual.version)
        elif atual is None:
            raise NotFoundError(f"Entrada {entry.id} nao existe.")
        elif atual.version != expected_version:
            raise VersionConflictError(expected_version, atual.version)

        salvo = entry.with_version((atual.version if atual else 0) + 1)
        self._itens[salvo.id] = salvo
        return salvo

    def delete(self, entry_id: str) -> None:
        self._itens.pop(entry_id, None)
