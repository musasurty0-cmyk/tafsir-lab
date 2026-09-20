# frame.md — design truth

**Concept angle.** A page of the app's Mushaf view, held for as long as the
āyah is being recited: warm paper, the Uthmani line, its number between two
hairlines, the meaning beneath an ochre rule.

## Colour

The app's light tokens, green excluded, ochre accent — the same palette as
`../seeing-his-face`.

| token      | value                 | role                        |
| ---------- | --------------------- | --------------------------- |
| `--bg`     | `#fcfbf8`             | paper                       |
| `--ink`    | `#292621`             | the āyah                    |
| `--ink-2`  | `#57534b`             | the translation             |
| `--line`   | `rgba(41,38,33,0.13)` | hairlines, dot grid         |
| `--accent` | `#a8762a`             | āyah number, rules, rail    |

## Type

| role            | family                | size                          |
| --------------- | --------------------- | ----------------------------- |
| the āyah        | Scheherazade New      | 49–78px, set per āyah         |
| the āyah number | Scheherazade New      | 42px, ochre                   |
| the translation | Literata              | 50px / 400                    |
| foot, URL       | Inter                 | 24–30px / 500, tracked        |
| the wordmark    | Source Serif 4 italic | 108px / 500                   |

**Scheherazade New, not Amiri Quran** — and that was a finding, not a
preference. Amiri Quran is the obvious pick for Uthmani text and it is what the
app lists first in `--font-arabic`. But the build Google Fonts serves has
broken mark attachment in Chrome: the ḥarakāt render in a **detached row
floating above the letters** instead of sitting on them. The subset is not the
cause — every mark this passage uses (U+064B–0654, U+0670, U+06DF, U+06E2) is
inside the served `unicode-range` — and self-hosting the identical woff2 did not
fix it, so it is the font build rather than the delivery. Verified side by side
in a real browser. Scheherazade New sets the same text correctly and is already
the app's own fallback for Uthmani script (`--font-uthmanic`).

**Sized per āyah.** Nine āyāt whose lengths differ by a factor of four; one
size would leave the short ones timid in the frame and break the long ones with
a single word orphaned. Nine lines, nine sizes.

## Layout

1080×1920. Content between y=280 and y=1560.

- **y 300** — the rail: one hairline filling across the recitation. It is full
  when he finishes; the closing card is not part of the reading.
- **y 500–1440** — the card: number, āyah, rule, meaning.
- **y 1500** — the foot: *Sūrat Maryam · 19:87–95* and the wordmark. Both it
  and the rail clear before the closing card.

Dot grid at 13% ink, static.

## Motion

The restraint is the design. Every card arrives the same way — a 44px rise over
0.40s — and leaves the same way, because no āyah here outranks another and
giving one a different entrance would be saying that it did. Between those two
moments nothing moves at all.

The only per-āyah timing finer than "which one is up" is 19:90, whose
translation arrives in two parts on the reciter's own breath at 23.20.

Rules: `spring-pop-entrance` (the card rise and the closing mark),
`svg-path-draw` (the rules drawing under each āyah), clip reveals on the close.
Deliberately **not** `asr-keyword-glow` — see BRIEF.
