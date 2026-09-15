import json
import threading
from pathlib import Path

import pytest

from shared_storage import JsonStore
from shared_storage.errors import DocumentNotFoundError, VersionConflictError

COLLECTION = "journal/entry"


@pytest.fixture
def store(tmp_path: Path) -> JsonStore:
    return JsonStore(tmp_path, index_fields={COLLECTION: ("date", "tags", "visibility")})


def test_grava_e_le_o_mesmo_documento(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"title": "incidente"}, partition="2026-09")
    assert store.read(COLLECTION, "01H8X", partition="2026-09")["title"] == "incidente"


def test_id_inexistente_devolve_none(store: JsonStore) -> None:
    assert store.read(COLLECTION, "naoexiste", partition="2026-09") is None


def test_primeira_gravacao_nasce_na_versao_um(store: JsonStore) -> None:
    saved = store.write(COLLECTION, "01H8X", {"title": "a"}, partition="2026-09")
    assert saved["version"] == 1


def test_gravacao_seguinte_incrementa_a_versao(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"title": "a"}, partition="2026-09")
    saved = store.write(
        COLLECTION, "01H8X", {"title": "b"}, partition="2026-09", expected_version=1
    )
    assert saved["version"] == 2


def test_versao_divergente_levanta_conflito(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"title": "a"}, partition="2026-09")
    with pytest.raises(VersionConflictError):
        store.write(COLLECTION, "01H8X", {"title": "b"}, partition="2026-09", expected_version=99)


def test_criar_por_cima_de_documento_existente_e_conflito(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"title": "a"}, partition="2026-09")
    with pytest.raises(VersionConflictError):
        store.write(COLLECTION, "01H8X", {"title": "b"}, partition="2026-09")


def test_atualizar_documento_inexistente_e_not_found(store: JsonStore) -> None:
    with pytest.raises(DocumentNotFoundError):
        store.write(COLLECTION, "fantasma", {"title": "a"}, partition="2026-09", expected_version=1)


def test_nao_deixa_arquivo_temporario_para_tras(store: JsonStore, tmp_path: Path) -> None:
    store.write(COLLECTION, "01H8X", {"title": "a"}, partition="2026-09")
    assert list(tmp_path.rglob("*.tmp")) == []


def test_arquivo_gravado_e_determinista(store: JsonStore, tmp_path: Path) -> None:
    store.write(COLLECTION, "01H8X", {"z": 1, "a": 2}, partition="2026-09")
    primeiro = (tmp_path / COLLECTION / "2026-09" / "01H8X.json").read_bytes()
    store.write(COLLECTION, "01H8Y", {"a": 2, "z": 1}, partition="2026-09")
    segundo = (tmp_path / COLLECTION / "2026-09" / "01H8Y.json").read_bytes()
    assert primeiro.replace(b"01H8X", b"") == segundo.replace(b"01H8Y", b"")


def test_acento_fica_legivel_no_arquivo(store: JsonStore, tmp_path: Path) -> None:
    store.write(COLLECTION, "01H8X", {"title": "manutenção"}, partition="2026-09")
    conteudo = (tmp_path / COLLECTION / "2026-09" / "01H8X.json").read_text(encoding="utf-8")
    assert "manutenção" in conteudo


def test_indice_recebe_apenas_os_campos_declarados(store: JsonStore) -> None:
    store.write(
        COLLECTION,
        "01H8X",
        {"date": "2026-09-14", "visibility": "PRIVATE", "body": "texto longo"},
        partition="2026-09",
    )
    (linha,) = store.read_index(COLLECTION)
    assert linha["date"] == "2026-09-14"
    assert linha["visibility"] == "PRIVATE"
    assert "body" not in linha


def test_indice_guarda_id_versao_e_particao(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"date": "2026-09-14"}, partition="2026-09")
    (linha,) = store.read_index(COLLECTION)
    assert linha["id"] == "01H8X"
    assert linha["version"] == 1
    assert linha["partition"] == "2026-09"


def test_indice_atualiza_em_vez_de_duplicar(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"date": "2026-09-14"}, partition="2026-09")
    store.write(
        COLLECTION, "01H8X", {"date": "2026-09-15"}, partition="2026-09", expected_version=1
    )
    linhas = store.read_index(COLLECTION)
    assert len(linhas) == 1
    assert linhas[0]["date"] == "2026-09-15"


def test_delete_remove_arquivo_e_linha_do_indice(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"date": "2026-09-14"}, partition="2026-09")
    store.delete(COLLECTION, "01H8X", partition="2026-09")
    assert store.read(COLLECTION, "01H8X", partition="2026-09") is None
    assert store.read_index(COLLECTION) == []


def test_indice_e_derivado_e_pode_ser_reconstruido(store: JsonStore, tmp_path: Path) -> None:
    store.write(COLLECTION, "01H8X", {"date": "2026-09-14"}, partition="2026-09")
    (tmp_path / COLLECTION / "_index.json").unlink()
    store.rebuild_index(COLLECTION)
    (linha,) = store.read_index(COLLECTION)
    assert linha["date"] == "2026-09-14"


def test_indice_corrompido_e_reconstruivel(store: JsonStore, tmp_path: Path) -> None:
    store.write(COLLECTION, "01H8X", {"date": "2026-09-14"}, partition="2026-09")
    (tmp_path / COLLECTION / "_index.json").write_text("{lixo", encoding="utf-8")
    store.rebuild_index(COLLECTION)
    assert len(store.read_index(COLLECTION)) == 1


def test_scan_le_apenas_as_particoes_pedidas(store: JsonStore) -> None:
    store.write(COLLECTION, "a", {"body": "setembro"}, partition="2026-09")
    store.write(COLLECTION, "b", {"body": "outubro"}, partition="2026-10")
    corpos = [doc["body"] for doc in store.scan(COLLECTION, partitions=["2026-09"])]
    assert corpos == ["setembro"]


def test_listagem_da_particao_vem_ordenada_por_id(store: JsonStore) -> None:
    for doc_id in ("01H8Z", "01H8X", "01H8Y"):
        store.write(COLLECTION, doc_id, {"body": doc_id}, partition="2026-09")
    assert [doc["id"] for doc in store.scan(COLLECTION, partitions=["2026-09"])] == [
        "01H8X",
        "01H8Y",
        "01H8Z",
    ]


def test_escrita_concorrente_no_mesmo_documento_nao_corrompe(store: JsonStore) -> None:
    store.write(COLLECTION, "01H8X", {"contador": 0}, partition="2026-09")
    erros: list[BaseException] = []

    def incrementa() -> None:
        for _ in range(20):
            try:
                atual = store.read(COLLECTION, "01H8X", partition="2026-09")
                store.write(
                    COLLECTION,
                    "01H8X",
                    {"contador": atual["contador"] + 1},
                    partition="2026-09",
                    expected_version=atual["version"],
                )
            except VersionConflictError:
                pass
            except BaseException as exc:
                erros.append(exc)

    threads = [threading.Thread(target=incrementa) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert erros == []
    final = store.read(COLLECTION, "01H8X", partition="2026-09")
    assert final is not None
    assert final["version"] >= 1


def test_escrita_concorrente_em_documentos_distintos_mantem_indice_integro(
    store: JsonStore, tmp_path: Path
) -> None:
    def grava(indice: int) -> None:
        store.write(COLLECTION, f"doc-{indice:03d}", {"n": indice}, partition="2026-09")

    threads = [threading.Thread(target=grava, args=(i,)) for i in range(40)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(store.read_index(COLLECTION)) == 40
    json.loads((tmp_path / COLLECTION / "_index.json").read_text(encoding="utf-8"))


def test_colecao_sem_campos_configurados_indexa_apenas_o_essencial(tmp_path: Path) -> None:
    store = JsonStore(tmp_path)
    store.write(COLLECTION, "01H8X", {"date": "2026-09-14"}, partition="2026-09")
    (linha,) = store.read_index(COLLECTION)
    assert set(linha) == {"id", "version", "partition"}


def test_campo_de_indice_e_configurado_uma_vez_e_vale_para_toda_gravacao(
    tmp_path: Path,
) -> None:
    """A garantia que justifica tirar index_fields da assinatura de write."""
    store = JsonStore(tmp_path, index_fields={COLLECTION: ("visibility",)})
    store.write(COLLECTION, "a", {"visibility": "PRIVATE"}, partition="2026-09")
    store.write(COLLECTION, "b", {"visibility": "REPORTABLE"}, partition="2026-09")
    assert [linha["visibility"] for linha in store.read_index(COLLECTION)] == [
        "PRIVATE",
        "REPORTABLE",
    ]
