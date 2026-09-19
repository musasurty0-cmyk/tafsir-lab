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
| the running caption      | Literata              | 76px / 700, -0.022em     |
| the climax line          | Literata              | 122px / 700              |
| Arabic hero              | Amiri                 | 150px / 700              |
| transliteration + gloss  | Literata italic       | 42px / 600               |
| the circled numerals     | Literata              | 110px / 700              |
| the wordmark             | Source Serif 4 italic | 108px / 500              |
| the running foot, the URL| Inter                 | 24–30px / 500, tracked   |

Literata, not the app's Source Serif 4. Same family of idea — a face built for
long-form reading on a warm ground — but shorter in the ascender and sturdier in
the stem, so it carries weight 700 without the thin strokes going spindly the
way a higher-contrast serif does. The words are the picture here; they should
have some mass. It sets wider than Source Serif 4 and with a taller x-height,
so every size comes down about 7% to hold the same line breaks.

The **wordmark stays in Source Serif 4** — the mark is brand truth and has to
match the other reel whatever the captions are set in.

Serif performs, sans recedes: a spoken reminder (serif, read) inside a piece of
software (sans, labelled). Arabic is Amiri because that is the face the app
already sets Arabic in; it is not decoration, it is the same text surface.

Sizes are in-feed sizes. The caption line never drops below 66px.

## Layout

1080×1920. Content lives between y=280 and y=1560 — Instagram's chrome owns
everything outside that.

- **y 360** — the rail: one hairline that fills left→right across the whole
  28s, and stops while he is not speaking. No ordinal — the two circled
  numerals in the caption stage carry the count, and a second set of digits
  on the rail would only say the same thing twice.
- **y 700–1240** — the caption stage. Beats are centred in this band and
  replace each other in place; nothing from a spent beat lingers.
- **y 1500** — the footer hairline and the khutbah title, set small and quiet.
  Both the rail and the foot clear at 28.40, before the closing card lands, so
  the mark is alone on the paper — and the foot's "TafsirLab" is not sitting
  under a wordmark saying the same thing.

Background: the app's fine dot grid at 13% ink, **static**. No drift, no crawl —
sub-pixel motion under 82px serif is the shimmer bug this project has already
paid for twice.

## Motion

Blueprint `kinetic-type-beats`, sub-shape B (multi-beat statement build).
Rules: `asr-keyword-glow` (karaoke variation — the per-word sync engine),
`kinetic-beat-slam` (distinct entrance per beat, onsets read off the transcript
instead of a musical pulse), `spring-pop-entrance` (the Arabic heroes and the
digits landing inside their rings), `svg-path-draw` (each numeral's ring
drawing itself from twelve o'clock), `css-marker-patterns` (the ochre marker
sweep under "no reason").

A counted point is drawn, not described: a ring closes and a digit lands in
it. The words "first of all" and "and secondly" say nothing the numeral does
not, and the numeral says it in a quarter of the time.

The closing card builds in four moves: the mark scale-pops, the wordmark slides
out from behind its edge, the ochre rule draws, the address rises. Both slides
are **clips, not fades** — fading a child inside a group that is itself fading
compounds the two, and a half-opaque glyph measures as a contrast failure
mid-entrance even though its resting state is 13:1. The rule is the same one
the two Arabic cards drew, which is what ties the ending to the middle rather
than bolting a logo onto the end.

The whole piece is ONE clip on one paper surface. Beats change; the surface,
the rule and the rail never cut — that continuity is what keeps 11 beats from
reading as 11 slides.
