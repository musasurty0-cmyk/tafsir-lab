---
workflow: product-launch-video
flow: automation
storyboard: no
message: "A folder of recordings you can never find anything in, turned into a library you can navigate by reciter and by place in the mushaf"
destination: instagram-reels
aspect: 1080x1920
language: en
length: 45.0s
angle: narrative
---

## Intent

A product trailer for **Recitations — a Tafsir Lab tool**: a local-first app
(`C:\Users\musas\Quran app`) that takes your own recitation files, asks who the
qari is and which surah, juz or ayah range each one covers, and files them into
the order of the mushaf.

Features the app's **own captured screens** as the assets — this is a showcase,
not an illustration of one.

Same design language as the reel series (`../seeing-his-face`, `../everything-you-do`):
warm paper, ink serif, a hairline that fills, a TafsirLab close.

## Angle

**Your archive, finally usable.** Chosen over two alternatives:

- *"It never leaves your device"* — the strongest claim the app makes about
  itself, and genuinely uncommon, but it is a claim about plumbing. It says
  nothing about what the thing is for.
- *"It orders itself by the mushaf"* — the cleverest mechanic, but it is the
  answer to a question the viewer has not been asked yet.

The chosen angle asks the question first: you have the recordings already, and
you cannot find anything. Then the mushaf ordering and the wheel arrive as the
answer rather than as a feature list.

## Assets — one continuous take, not stills

`assets/session.mp4` is **thirty seconds of the app being used**, recorded in
one pass by `record.mjs`: scrolled, opened, filtered, played.

The first cut of this trailer used four still screenshots, each held for seven
or eight seconds while a headline sat above it. It read as a slideshow of a
product rather than a product — the same fault the Maryam reel had before it
was rebuilt as one page that scrolls, and the same one the opening of
`../everything-you-do` had before the Arabic was made to ink word by word. The
rule this project keeps relearning: **something has to be advancing, and the
surface has to be continuous.**

So there are no stills. The take is timed against the beats, so each milestone
lands where its headline does:

| take | beat |
| ---- | ---- |
| 0.0–7.2 | the reciters, scrolling |
| 7.2–15.4 | one reciter, scrolling by juz |
| 15.4–23.2 | the coverage wheel, opened and filtered to Ya-Sin |
| 23.2–30.2 | played — and the queue advances, Yusuf → Maryam → Ya-Sin |

Recorded at 390×844 with `deviceScaleFactor: 2` (780×1688) into a 560px device
box, so it is still above 1:1 at render size.

**Known tell:** the seeded recordings carry realistic durations in their
metadata (38:00, 47:00) but their audio is a two-second silent wav, so the
player's own scrubber reads 0:02. That short file is also *why* the queue
advances on camera, which is the best motion in the piece — a fair trade, but
worth knowing it is there.

The library is **seeded**, not real: five reciters and seventeen recordings
written straight into IndexedDB by `seed-library.js`, evaluated in a throwaway
headless profile. Nothing in the recording can reach a real one.

## Customizations

- **Ochre chrome, green screens.** The app's accent is Tafsir Lab's emerald
  (`oklch(0.55 0.08 160)`); the reel series deliberately excludes green and runs
  on ochre. So the page keeps the series' ochre and the app keeps its own green
  *inside the device frame*, which is the normal relationship between a page and
  a screenshot on it.
- **The device is drawn, not photographed** — a rounded rectangle with a dark
  bezel ring and one soft shadow, in the same hairline idiom as the book and the
  marks in `../everything-you-do`.
- **Nothing is done to the screen.** No push, no cross-fade, no Ken Burns — the
  recording is already the motion, and pushing stills around was the first
  cut's mistake: the transitions were the only thing moving, so the app read as
  a set of pictures being flicked through.

## Shape

| beat | what is on screen |
| ---- | ----------------- |
| the folder | filenames, monospace, unsorted — the problem, stated as evidence |
| the reciters | the take, scrolling |
| the ordering | the take, scrolling through juz groups |
| the whole archive | the take, the wheel opening and filtering |
| playing | the take, the queue advancing |
| close | TafsirLab mark, the app's name, the URL |
