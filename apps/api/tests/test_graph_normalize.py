from app.graph import is_functional, normalize, normalize_relation


def test_normalize_turkish_case():
    assert normalize("İSTANBUL") == normalize("istanbul")
    assert normalize("  Acme  A.Ş. ") == "acme"
    assert normalize("OpenAI, Inc.") == "openai"


def test_relation_normalization():
    assert normalize_relation("Yan_Etkisi") == "yan etkisi"


def test_functional_relations():
    assert is_functional("kuruluş tarihi")
    assert is_functional("release_date")
    assert not is_functional("geliştirdi")
