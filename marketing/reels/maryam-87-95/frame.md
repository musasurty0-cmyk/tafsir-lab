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

## The rhyme

Every āyah in this passage closes on the same `-an` sound: *ʿahdan, waladan,
iddan, haddan, waladan, waladan, ʿabdan, ʿaddan, fardan*. That is the passage's
own **fāṣila**, and it carries a madder red (`--mark`, #9c3a2c, 6.6:1 on this
paper) in the Arabic and in its English counterpart both. Red is how a printed
Mushaf has always annotated its own text.

**It turns red at the moment he says it**, not before — so the colour is an
event in the recitation rather than a decoration on the page. Seven of the nine
onsets came from word-level transcription of each āyah on its own; on 89 and 90
the recogniser dropped the final word, so those two were read off a 5 ms
envelope as the last onset before the closing decay (14.60, after *shayʾan*
lands at 14.26; 27.02, after *al-jibāl*).

**19:87 carries no mark.** Its rhyme is *ʿahdan*, "a covenant" — the word is
not part of what this passage is arguing, and colouring it only because it
rhymes would be applying the rule instead of reading the text.

## Motion

**It is one page, and it scrolls.** Not nine cards: all nine āyāt live on a
single column that moves the way a reader moves down a page. What he has
already recited stays above at a reading-room dimness, what is coming waits
below, and the āyah he is on sits at the reading line in full ink. Nothing is
ever replaced and nothing disappears — which is the whole difference between a
page and a slideshow, and is why this is not built the way the first two
versions were.

The column's position for each āyah is **measured at build time** — the block's
own `offsetTop` and height against the reading line — which is allowed here
because this is a single-scene composition and everything is laid out before
the timeline is built. The move between āyāt is a 0.78s eased glide starting
0.35s before he begins, so it has settled by the time he speaks.

The window is masked top and bottom, so āyāt fade out at the edges rather than
being cut off by a hard line.

Under it, the **spine**: nine segments, each as wide as the share of the
recitation its āyah takes — 19:90 is a fifth of the passage and looks it —
filling continuously, so something is always advancing even while an āyah
holds.

The one place the timing goes finer than "which āyah is at the line" is 19:90,
the only āyah he stops inside (23.33, measured at 17.0 dB under his own loud
level for that āyah; every other dip in the passage is a 5–10 dB word gap, not
a stop). There the cut lands in **both scripts** — the Arabic holds at *minhu*
and the rest arrives with the second half of the meaning.
