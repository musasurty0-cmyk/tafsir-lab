r"""
Guards for arabic.py. Every string here is \u escapes — the bug these tests exist
to catch was invisible precisely because the source LOOKED right.

The first test is the important one: if a character class has been reordered into
a range that swallows the alphabet, normalisation returns "" and every comparison
downstream silently succeeds. Assert letters survive before asserting anything else.
"""
import arabic as A

ALPHABET = "".join(chr(c) for c in range(0x0621, 0x064B))

def test_classes_do_not_eat_letters():
    assert A.bare(ALPHABET) != ""
    assert len(A.bare(ALPHABET)) >= 25, "a character class is swallowing letters"
    assert A.bare("العضو") == "العضو"

def test_dagger_alif_becomes_a_long_a():
    # إِبْرَٰهِيمُ  vs  إبراهيم
    assert A.spelling("إِبْرَٰهِيمُ") \
        == A.spelling("إبراهيم")

def test_alif_wasla_survives_as_alif():
    # ٱلَّذِينَ  vs  الذين
    assert A.spelling("ٱلَّذِينَ") \
        == A.spelling("الذين")

def test_mushaf_open_ta_in_idafa():
    # رَحْمَتِ  vs  رحمة
    assert A.spelling("رَحْمَتِ") \
        == A.spelling("رحمة")

def test_case_endings_differ_in_spelling_but_share_a_stem():
    pairs = [("خفية", "خَفِيًّا"),   # khafiyya
             ("شقية", "شَقِيًّا"),   # shaqiyya
             ("عاقرة", "عَاقِرًا")]  # aaqira
    for a, b in pairs:
        assert A.spelling(a) != A.spelling(b), (a, b)
        assert A.stem(a) == A.stem(b), (a, b, A.stem(a), A.stem(b))

def test_genuinely_different_words_stay_different():
    # عزيناه / ءَاتَيْنَـٰهُ   and   العضو / ٱلْعَظْمُ
    assert A.stem("عزيناه") \
        != A.stem("ءَاتَيْنَـٰهُ")
    assert A.stem("العضو") \
        != A.stem("ٱلْعَظْمُ")

def test_stem_never_empties_a_word():
    for w in ("في", "من", "او", "يا"):
        assert len(A.stem(w)) >= 2

def test_alif_orthography_is_not_a_different_word():
    same = [("أولئك", "أُو۟لَـٰٓئِكَ"),
            ("السموات", "ٱلسَّمَـٰوَٰتُ"),
            ("الرحمن", "ٱلرَّحْمَـٰنُ")]
    for a, b in same:
        assert A.skeleton(a) == A.skeleton(b), (a, b, A.skeleton(a), A.skeleton(b))

def test_skeleton_still_separates_real_words():
    assert A.skeleton("عزيناه") != A.skeleton("ءَاتَيْنَـٰهُ")
    assert A.skeleton("العضو")   != A.skeleton("ٱلْعَظْمُ")

if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if not name.startswith("test_"):
            continue
        try:
            fn(); print(f"  ok   {name}")
        except AssertionError as e:
            fails += 1; print(f"  FAIL {name}: {e}")
    print("\n  all guards pass" if not fails else f"\n  {fails} FAILING — do not trust output")
    raise SystemExit(1 if fails else 0)
