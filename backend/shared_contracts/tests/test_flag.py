import pytest

from shared_contracts import Flag, InvalidFlagError


def test_parse_normaliza_para_maiusculas() -> None:
    assert Flag.parse("user.login") == Flag(domain="USER", subdomain="LOGIN")


def test_parse_aceita_formato_canonico() -> None:
    flag = Flag.parse("JOURNAL.ENTRY")
    assert flag.domain == "JOURNAL"
    assert flag.subdomain == "ENTRY"


@pytest.mark.parametrize(
    "raw",
    ["USER", "USER.LOGIN.EXTRA", "", ".", "USER.", ".LOGIN", "   "],
)
def test_parse_rejeita_formato_invalido(raw: str) -> None:
    with pytest.raises(InvalidFlagError):
        Flag.parse(raw)


def test_flag_e_hashable_para_servir_de_chave_no_registry() -> None:
    registry = {Flag.parse("USER.LOGIN"): "handler"}
    assert registry[Flag("USER", "LOGIN")] == "handler"


def test_flag_e_imutavel() -> None:
    flag = Flag.parse("USER.LOGIN")
    with pytest.raises(AttributeError):
        flag.domain = "OUTRO"  # type: ignore[misc]


def test_flag_nao_tem_dict_por_causa_de_slots() -> None:
    assert not hasattr(Flag.parse("USER.LOGIN"), "__dict__")


def test_str_devolve_o_formato_canonico() -> None:
    assert str(Flag.parse("user.login")) == "USER.LOGIN"


def test_erro_carrega_a_flag_recebida() -> None:
    with pytest.raises(InvalidFlagError) as excinfo:
        Flag.parse("QUEBRADA")
    assert "QUEBRADA" in str(excinfo.value)
