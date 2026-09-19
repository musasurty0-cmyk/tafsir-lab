# frame.md — design truth

**Concept angle.** The reminder is set as a page from the study app itself:
warm paper, ink serif, a hairline rule that advances as he speaks, each word
darkening at the instant it is said — and the two Arabic phrases rising out of
the running line into the frame, the way a tapped word opens in Tafsir Lab.

## Colour

Straight from `app/globals.css`, light tokens, green excluded.

| token          | value                    | role                                    |
| -------------- | ------------------------ | --------------------------------------- |
| `--bg`         | `#fcfbf8`                | paper ground                            |
| `--ink`        | `#292621`                | the word being spoken                   |
| `--ink-3`      | `#6e695f`                | supporting lines, transliteration       |
| `--ink-4`      | `#8a8579`                | words not yet spoken, and spent words   |
| `--line`       | `rgba(41,38,33,0.13)`    | hairlines, dot grid                     |
| `--accent`     | `#a8762a`                | ochre: ordinals, marker sweep, the rule |

`--ink-4` on `--bg` is 3.3:1 — above AA-large, which every caption size here
clears by a wide margin. The karaoke read comes from the *distance* between
`--ink-4` and `--ink`, not from dropping the resting word below legibility.

## Type

| role                     | family                | size / weight            |
| ------------------------ | --------------------- | ------------------------ |
| the running caption      | Source Serif 4        | 82px / 600, -0.02em      |
| the climax line          | Source Serif 4        | 104px / 600              |
| Arabic hero              | Amiri                 | 150px / 700              |
| transliteration + gloss  | Source Serif 4 italic | 40px / 500               |
| ordinals, eyebrow, mark  | Inter                 | 28px / 600, 0.14em caps  |

Serif performs, sans recedes — the app's own pairing, and the tension is the
real one in the material: a spoken reminder (serif, read) inside a piece of
software (sans, labelled). Arabic is Amiri because that is the face the app
already sets Arabic in; it is not decoration, it is the same text surface.

Sizes are in-feed sizes. The caption line never drops below 82px.

## Layout

1080×1920. Content lives between y=280 and y=1560 — Instagram's chrome owns
everything outside that.

- **y 360** — the rail: ordinal on the left, TafsirLab mark on the right,
  a hairline between them that fills left→right across the whole 28s.
- **y 700–1240** — the caption stage. Beats are centred in this band and
  replace each other in place; nothing from a spent beat lingers.
- **y 1500** — the footer hairline and the khutbah title, set small and quiet.

Background: the app's fine dot grid at 13% ink, **static**. No drift, no crawl —
sub-pixel motion under 82px serif is the shimmer bug this project has already
paid for twice.

## Motion

Blueprint `kinetic-type-beats`, sub-shape B (multi-beat statement build).
Rules: `asr-keyword-glow` (karaoke variation — the per-word sync engine),
`kinetic-beat-slam` (distinct entrance per beat, onsets read off the transcript
instead of a musical pulse), `spring-pop-entrance` (the Arabic heroes),
`scale-swap-transition` (the English word morphing into the Arabic at one
centre), `css-marker-patterns` (the ochre marker sweep under "no reason").

The whole piece is ONE clip on one paper surface. Beats change; the surface,
the rule and the rail never cut — that continuity is what keeps 11 beats from
reading as 11 slides.
