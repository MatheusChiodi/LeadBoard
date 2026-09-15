"""Escrita atomica de arquivo JSON.

Gravar por cima do arquivo destroi o dado se o processo morrer no meio, e o que
sobra nao e a versao antiga nem a nova: e lixo.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import TypeAlias
from uuid import uuid4

JsonValue: TypeAlias = "str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]"
JsonDocument: TypeAlias = "dict[str, JsonValue]"

_REPLACE_ATTEMPTS = 6
_REPLACE_BACKOFF_SECONDS = 0.002


def _replace_with_retry(tmp: Path, path: Path) -> None:
    """`os.replace` com retentativa curta, por causa do Windows.

    No POSIX o rename sobre um arquivo aberto sempre funciona: o leitor continua
    com o inode antigo. No Windows o destino aberto por outro handle sem
    FILE_SHARE_DELETE faz o MoveFileEx devolver PermissionError — e Python abre
    arquivo sem esse flag.

    Na pratica isso acontece com leitura concorrente, com o indexador do Windows,
    com antivirus e com o git varrendo a pasta `data/`. A janela e de
    microssegundos, entao backoff exponencial curto resolve sem mascarar erro
    real: esgotadas as tentativas, a excecao sobe.
    """
    delay = _REPLACE_BACKOFF_SECONDS
    for attempt in range(_REPLACE_ATTEMPTS):
        try:
            os.replace(tmp, path)
        except PermissionError:
            if attempt == _REPLACE_ATTEMPTS - 1:
                raise
            time.sleep(delay)
            delay *= 2
        else:
            return


def write_atomic(path: Path, payload: JsonDocument) -> None:
    """Grava `payload` em `path` sem janela de arquivo pela metade.

    Quatro detalhes que nao sao opcionais:

    - O temporario fica NO MESMO diretorio do destino. `os.replace` so e atomico
      dentro do mesmo sistema de arquivos; usar a pasta temporaria do SO quebra a
      garantia.
    - `fsync` antes do replace. Sem ele o rename pode chegar ao disco antes do
      conteudo, e o resultado depois de uma queda de energia e um arquivo vazio.
    - `ensure_ascii=False` e `indent=2` porque acento precisa ser legivel e diff
      precisa ser diff.
    - `sort_keys=True` para o mesmo dado gerar sempre o mesmo texto. Sem isso cada
      gravacao vira um diff falso no git, que e o backup deste sistema.

    O sufixo do temporario e unico por escrita: com nome fixo, dois escritores do
    mesmo agregado (workers distintos, onde o lock de thread nao alcanca) disputam
    o mesmo `.tmp` e um sobrescreve o conteudo do outro antes do replace.

    No Windows `os.replace` continua atomico, mas nao existe fsync de diretorio —
    a entrada do rename pode demorar a ser persistida. O agregado nunca fica
    corrompido; no pior caso a gravacao mais recente se perde inteira.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    try:
        with tmp.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.flush()
            os.fsync(handle.fileno())
        _replace_with_retry(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def read_json(path: Path) -> JsonDocument | None:
    """Le um documento. Arquivo ausente devolve None; arquivo ilegivel propaga."""
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as handle:
        loaded: JsonDocument = json.load(handle)
    return loaded
