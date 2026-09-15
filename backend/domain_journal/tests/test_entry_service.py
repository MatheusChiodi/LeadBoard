from datetime import UTC, date, datetime

import pytest

from domain_journal.entry.models import Entry
from domain_journal.entry.service import EntryService
from shared_contracts import (
    ConfirmEntry,
    CreateEntry,
    DeleteEntry,
    DiagramShared,
    EntrySource,
    EntryStatus,
    GetEntry,
    ListEntries,
    NotFoundError,
    PromoteEntry,
    TaskCompleted,
    UpdateEntry,
    Visibility,
)


class RepositorioFake:
    """Implementa o mesmo Protocol do real, nao um MagicMock.

    Mock que aceita qualquer chamada esconde mudanca de assinatura; a classe fake
    quebra no mypy junto com o resto.
    """

    def __init__(self) -> None:
        self.itens: dict[str, Entry] = {}

    def get(self, entry_id: str) -> Entry | None:
        return self.itens.get(entry_id)

    def list_by_period(self, start: date, end: date, *, tags: tuple[str, ...] = ()) -> list[Entry]:
        encontrados = [item for item in self.itens.values() if start <= item.occurred_on <= end]
        if tags:
            encontrados = [item for item in encontrados if set(tags) & set(item.tags)]
        return sorted(encontrados, key=lambda item: (item.occurred_on, item.id))

    def save(self, entry: Entry, expected_version: int | None) -> Entry:
        salvo = entry.with_version((expected_version or 0) + 1)
        self.itens[salvo.id] = salvo
        return salvo

    def delete(self, entry_id: str) -> None:
        self.itens.pop(entry_id, None)


@pytest.fixture
def repository() -> RepositorioFake:
    return RepositorioFake()


@pytest.fixture
def service(repository: RepositorioFake) -> EntryService:
    return EntryService(repository=repository, now=lambda: datetime(2026, 9, 15, tzinfo=UTC))


def _criar(service: EntryService, titulo: str = "incidente", **extra: object) -> str:
    comando = CreateEntry(title=titulo, occurred_on=date(2026, 9, 15), **extra)  # type: ignore[arg-type]
    return service.create(comando, user_id="u1").id


# ------------------------------------------------------------------- visibilidade


def test_entrada_nasce_privada_por_padrao(service: EntryService) -> None:
    resposta = service.create(
        CreateEntry(title="alguem travou no deploy", occurred_on=date(2026, 9, 15)),
        user_id="u1",
    )
    assert resposta.visibility is Visibility.PRIVATE


def test_relatorio_nunca_enxerga_entrada_privada(service: EntryService) -> None:
    """O teste mais importante do dominio inteiro (secao 4).

    Se ele ficar vermelho, uma observacao crua sobre um colega pode chegar a
    gestao. Nenhum outro defeito deste sistema custa isso.
    """
    _criar(service, "alguem entregou tarde", visibility=Visibility.PRIVATE)
    _criar(service, "entrega da sprint", visibility=Visibility.REPORTABLE)

    reportaveis = service.list(
        ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30), only_reportable=True)
    )

    assert [item.title for item in reportaveis.entries] == ["entrega da sprint"]
    assert all(item.visibility is Visibility.REPORTABLE for item in reportaveis.entries)


def test_listagem_sem_filtro_e_do_autor_e_enxerga_tudo(service: EntryService) -> None:
    _criar(service, "privada", visibility=Visibility.PRIVATE)
    _criar(service, "reportavel", visibility=Visibility.REPORTABLE)
    todas = service.list(ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30)))
    assert todas.total == 2


def test_promover_e_ato_explicito(service: EntryService) -> None:
    entry_id = _criar(service)
    promovida = service.promote(
        PromoteEntry(entry_id=entry_id, expected_version=1, visibility=Visibility.REPORTABLE)
    )
    assert promovida.visibility is Visibility.REPORTABLE


def test_update_nao_consegue_mexer_em_visibilidade(service: EntryService) -> None:
    """`UpdateEntry` nao tem campo de visibilidade — e a garantia e estrutural."""
    assert "visibility" not in UpdateEntry.model_fields


def test_editar_texto_preserva_a_visibilidade(service: EntryService) -> None:
    entry_id = _criar(service, visibility=Visibility.REPORTABLE)
    editada = service.update(
        UpdateEntry(entry_id=entry_id, expected_version=1, title="titulo corrigido")
    )
    assert editada.visibility is Visibility.REPORTABLE
    assert editada.title == "titulo corrigido"


def test_rebaixar_para_privada_e_permitido(service: EntryService) -> None:
    entry_id = _criar(service, visibility=Visibility.REPORTABLE)
    rebaixada = service.promote(
        PromoteEntry(entry_id=entry_id, expected_version=1, visibility=Visibility.PRIVATE)
    )
    assert rebaixada.visibility is Visibility.PRIVATE


# ---------------------------------------------------------------- entrada por evento


def test_evento_de_tarefa_vira_rascunho_privado(service: EntryService) -> None:
    service.on_event(
        TaskCompleted(
            event_id="e1",
            occurred_at=datetime(2026, 9, 15, tzinfo=UTC),
            user_id="u1",
            task_id="t1",
            title="subir o gateway",
        )
    )
    encontradas = service.list(ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30)))
    (entrada,) = encontradas.entries
    assert entrada.status is EntryStatus.DRAFT
    assert entrada.visibility is Visibility.PRIVATE
    assert entrada.source is EntrySource.EVENT


def test_rascunho_de_evento_nunca_nasce_reportavel(service: EntryService) -> None:
    service.on_event(
        DiagramShared(
            event_id="e2",
            occurred_at=datetime(2026, 9, 15, tzinfo=UTC),
            user_id="u1",
            diagram_id="d1",
            title="topologia",
            shared_with=("gestao",),
        )
    )
    reportaveis = service.list(
        ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30), only_reportable=True)
    )
    assert reportaveis.total == 0


def test_rascunho_confirmado_vira_registro(service: EntryService) -> None:
    service.on_event(
        TaskCompleted(
            event_id="e1",
            occurred_at=datetime(2026, 9, 15, tzinfo=UTC),
            user_id="u1",
            task_id="t1",
            title="subir o gateway",
        )
    )
    (rascunho,) = service.list(ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30))).entries
    confirmada = service.confirm(
        ConfirmEntry(entry_id=rascunho.id, expected_version=rascunho.version)
    )
    assert confirmada.status is EntryStatus.CONFIRMED


def test_entrada_manual_ja_nasce_confirmada(service: EntryService) -> None:
    resposta = service.create(
        CreateEntry(title="escrita a mao", occurred_on=date(2026, 9, 15)), user_id="u1"
    )
    assert resposta.status is EntryStatus.CONFIRMED
    assert resposta.source is EntrySource.MANUAL


def test_o_mesmo_evento_nao_gera_duas_entradas(service: EntryService) -> None:
    """Barramento que reentrega nao pode duplicar o diario."""
    evento = TaskCompleted(
        event_id="e1",
        occurred_at=datetime(2026, 9, 15, tzinfo=UTC),
        user_id="u1",
        task_id="t1",
        title="subir o gateway",
    )
    service.on_event(evento)
    service.on_event(evento)
    assert service.list(ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30))).total == 1


# ------------------------------------------------------------------- periodo e leitura


def test_periodo_filtra_pelas_bordas(service: EntryService) -> None:
    for dia in (14, 15, 16):
        service.create(
            CreateEntry(title=f"dia {dia}", occurred_on=date(2026, 9, dia)), user_id="u1"
        )
    encontradas = service.list(ListEntries(start=date(2026, 9, 15), end=date(2026, 9, 15)))
    assert [item.title for item in encontradas.entries] == ["dia 15"]


def test_filtro_por_tag(service: EntryService) -> None:
    _criar(service, "com tag", tags=("incidente",))
    _criar(service, "sem tag")
    encontradas = service.list(
        ListEntries(start=date(2026, 9, 1), end=date(2026, 9, 30), tags=("incidente",))
    )
    assert encontradas.total == 1


def test_buscar_entrada_inexistente_e_not_found(service: EntryService) -> None:
    with pytest.raises(NotFoundError):
        service.get(GetEntry(entry_id="fantasma"))


def test_apagar_entrada_inexistente_e_not_found(service: EntryService) -> None:
    with pytest.raises(NotFoundError):
        service.delete(DeleteEntry(entry_id="fantasma", expected_version=1))


def test_apagar_remove_a_entrada(service: EntryService) -> None:
    entry_id = _criar(service)
    service.delete(DeleteEntry(entry_id=entry_id, expected_version=1))
    with pytest.raises(NotFoundError):
        service.get(GetEntry(entry_id=entry_id))


def test_id_ordena_cronologicamente(service: EntryService) -> None:
    """ULID em vez de UUIDv4: listagem ordenada de graca, sem abrir arquivo."""
    ids = [_criar(service, f"entrada {i}") for i in range(5)]
    assert ids == sorted(ids)


def test_service_devolve_dto_nunca_modelo_interno(service: EntryService) -> None:
    resposta = service.create(CreateEntry(title="x", occurred_on=date(2026, 9, 15)), user_id="u1")
    assert not isinstance(resposta, Entry)
    assert resposta.__class__.__name__ == "EntryResponse"
