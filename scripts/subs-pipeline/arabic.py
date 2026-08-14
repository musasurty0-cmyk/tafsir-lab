r"""
Arabic normalisation, in \u escapes only.

Literal Arabic inside a regex character class is a trap: the source is visually
reordered by bidi as it is written, and an earlier version of this code ended up
with a range covering the entire Arabic alphabet. It then reported that every
quotation in the video matched the mushaf perfectly, because it was comparing
empty strings. Escapes cannot be reordered, so escapes are what this file uses,
and every function is unit-tested in test_arabic.py against cases whose answer is
known in advance.

Three levels, each stricter about what it will call "the same":

  bare()      vowel marks off, letters as written
  spelling()  + fold choices with no acoustic content — alif seats, hamza
              carriers, alif maqsura, the mushaf's open ta in idafa
  stem()      + drop trailing weak letters, which carry the case endings a
              reciter pausing at a phrase end does not pronounce

Both sides of a comparison must go through the same level.
"""
import re

# Letters and marks, by codepoint.
ALIF_SEATS  = "آأإٱٲٳ"  # aa, hamza above/below, wasla
HAMZA_SEATS = "ءؤئ"                    # bare, on waw, on ya
WEAK_TAIL   = "اوينةه"  # alif waw ya nun ta-marbuta ha
DAGGER      = "ٰ"   # superscript alif: a long aa written small
TATWEEL     = "ـ"

_HARAKAT = re.compile("[ؐ-ًؚ-ٟۖ-ۭ" + TATWEEL + "]")
_KEEP    = re.compile("[^ء-ي]")
_ALIF    = re.compile("[" + ALIF_SEATS + "]")
_HAMZA   = re.compile("[" + HAMZA_SEATS + "]")
_TAIL    = re.compile("[" + WEAK_TAIL + "]+$")
_FINAL_T = re.compile("[ةت]$")             # ta marbuta / open ta

def bare(w: str) -> str:
    """Vowel marks and tatweel off. Alif-wasla and dagger alif survive as alif."""
    # The dagger alif is a LETTER wearing a diacritic's clothes: إِبْرَٰهِيمُ holds the
    # same long aa that ordinary إبراهيم spells out in full. Stripping it with the
    # vowel marks made every mushaf spelling disagree with what Whisper writes, so
    # it is expanded before anything is removed.
    w = w.replace(DAGGER, "ا")
    return _KEEP.sub("", _ALIF.sub("ا", _HARAKAT.sub("", w)))

def spelling(w: str) -> str:
    """Fold the orthography that carries no difference in sound."""
    w = _HAMZA.sub("", bare(w))
    w = w.replace("ى", "ي")                # alif maqsura -> ya
    # The mushaf writes idafa with an open ta — رَحْمَتِ رَبِّكَ — where ordinary
    # orthography writes رحمة. Identical in the mouth, so fold both to one form.
    return _FINAL_T.sub("ه", w)

def stem(w: str) -> str:
    """Expose the word body by dropping the whole trailing weak run, not one of it."""
    s = spelling(w)
    t = _TAIL.sub("", s)
    return t if len(t) >= 2 else s                   # never strip to nothing

def skeleton(w: str) -> str:
    """spelling() minus every alif.

    Alif is the letter Arabic orthography is least consistent about. The mushaf
    writes أُو۟لَـٰٓئِكَ, ٱلسَّمَـٰوَٰتُ and إِبْرَٰهِيمُ where ordinary text writes أولئك,
    السموات and إبراهيم — the long aa is sometimes a letter, sometimes a mark,
    sometimes nothing at all. None of that is audible. Two forms that agree once
    alif is removed are the same word differently spelled, not different words.
    """
    return spelling(w).replace("ا", "")
