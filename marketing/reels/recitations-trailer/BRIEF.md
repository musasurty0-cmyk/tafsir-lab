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

## Assets

Captured by `capture.mjs`, which drives the real app in headless Chrome at
390×844 with `deviceScaleFactor: 3` — so each screen lands at **1170×2532** and
sits in a 1080-wide frame with pixels to spare.

| file | screen |
| ---- | ------ |
| `assets/01-home.png` | the reciters, five of them, with what you hold of each |
| `assets/02-qari.png` | one reciter's recordings, grouped **by juz** — the ordering, proved |
| `assets/03-wheel.png` | the surah wheel: 114 rings, filled where you have a recording |
| `assets/05-nowplaying.png` | the player, Arabic title, Read-along tab |

`assets/04-dock.png` was captured and is unused — the mini player says nothing
the full player does not.

The library those screens show is **seeded**, not real: five reciters and
sixteen recordings written straight into IndexedDB by `capture.mjs`. The app
reads metadata on boot and only touches audio on playback, so a two-second
silent wav per recording is enough to make the archive behave. Nothing in the
capture touches a real profile.

## Customizations

- **Ochre chrome, green screens.** The app's accent is Tafsir Lab's emerald
  (`oklch(0.55 0.08 160)`); the reel series deliberately excludes green and runs
  on ochre. So the page keeps the series' ochre and the app keeps its own green
  *inside the device frame*, which is the normal relationship between a page and
  a screenshot on it.
- **The device is drawn, not photographed** — a rounded rectangle with a dark
  bezel ring and one soft shadow, in the same hairline idiom as the book and the
  marks in `../everything-you-do`.
- **Screens enter as navigation**, sliding in from the right in the order you
  would actually reach them: home → a reciter → the coverage wheel → the player.

## Shape

| beat | what is on screen |
| ---- | ----------------- |
| the folder | filenames, monospace, unsorted — the problem, stated as evidence |
| the reciters | `01-home` |
| the ordering | `02-qari`, grouped by juz |
| the whole archive | `03-wheel` |
| playing | `05-nowplaying` |
| close | TafsirLab mark, the app's name, the URL |
