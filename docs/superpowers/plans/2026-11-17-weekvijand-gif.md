# De weekvijand in beeld: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bij elke aanval op de weekvijand komt er een zelfgetekende GIF van de klap in de draad onder het raidbord.

**Architecture:** `lib/vijandbeeld.js` tekent pure SVG-films. `naarGif` (lib/casinobeeld.js) zet ze om naar een GIF. index.js zet de GIF op R2 en voegt hem met `chat.update` toe aan het bericht dat al in de draad staat.

**Tech Stack:** Node 20, @resvg/resvg-js 2.6.2, gifenc 1.0.3, node:test.

**Spec:** docs/superpowers/specs/2026-11-17-weekvijand-gif-design.md

## Global Constraints

- Scène 480 × 400; hoogstens ~60 beelden en onder 1 MB; de film speelt één keer af.
- Geen namen van leden in de SVG. Tekst in DejaVu Sans uit `fonts/`.
- Alleen uploaden naar R2 (`R2_BUCKET` gezet), onder `weekvijand/`; nooit naar imgbb.
- De tekstregel gaat eerst de deur uit. De GIF is een `chat.update` achteraf, en een fout daarin breekt niets.

## Review Focus

- Een weekvijand-sleutel die niet in de tabel staat (nieuwe snack): die moet terugvallen op een bal, niet crashen.
- Een naam met `&` of `<`: die moet ge-escaped worden, anders weigert resvg de SVG.
- Schade groter dan de resterende HP: de balk mag niet onder nul tekenen.
- Een gewone misser (schade 0) tegen een gave zonder wegduiken (samen, offerdoof): "MIS!" en de HP blijft staan.
- Het kanon geeft de genadeslag: de kanonfilm eindigt met "VERSLAGEN!".

---

### Task 1: Palet uit alle beelden in naarGif

**Files:** Modify `lib/casinobeeld.js` (`naarGif`); test `lib/casinobeeld.test.js`.

- [ ] Test: een film waarvan een kleur alleen in het middelste beeld voorkomt, heeft die kleur (op een paar eenheden na) in het palet van de GIF.
- [ ] `naarGif` rendert alle beelden, haalt `pixels` per beeld één keer op (de getter kopieert) en kwantiseert een steekproef van elke 7e pixel uit alle beelden.
- [ ] `npm test`.

### Task 2: lib/vijandbeeld.js: vormen, snacks en films

**Files:** Create `lib/vijandbeeld.js` and `lib/vijandbeeld.test.js`.

**Interfaces (Produces):**
- `aanvalFilm({ vijandKey, vijandNaam, wapen, schade, hpVoor, maxHp, gemist, ketst, terugslag, offer, razend, gave, pekelBonus }) → [{ svg, ms }]`
- `kanonFilm({ vijandKey, vijandNaam, schade, hpVoor, maxHp, razend }) → [{ svg, ms }]`
- `UITERLIJK` (sleutel → `{ vorm, kleur: [licht, basis, donker], binnen, beleg }`), `VORMEN`

- [ ] Tests:
  - elke sleutel uit `WEEKVIJANDEN` in index.js staat in `UITERLIJK`, met een bestaande vorm;
  - elk wapen plus `null` en het kanon geeft een film waarvan het middelste en het laatste beeld met resvg renderen;
  - het laatste beeld toont `hpNa/maxHp`;
  - een misser toont "MIS!" en houdt de HP gelijk;
  - een ketsende bom toont "KETST!";
  - terugslag toont "−2 PT";
  - de genadeslag toont "VERSLAGEN!" en `0/`;
  - een onbekende sleutel valt terug op een bal;
  - een naam met `&` rendert;
  - een volledige film wordt via `naarGif` een GIF van minder dan 1 MB.
- [ ] Implementeer de twaalf vormen, de snacktabel, de acht wapens en het kanon, plus de situaties misser, ketst, terugslag, genadeslag en razend.
- [ ] `npm test`, en bekijk een contactblad met sleutelbeelden van elke vorm en elk wapen.

### Task 3: Inhaken in index.js

**Files:** Modify `index.js`: `zetOpImgbb` (optie `map`), `voerBamischijfAanval`, `legInKanon`, nieuwe `voegVijandGifToe`.

- [ ] `zetOpImgbb(buf, naam, { map })` schrijft naar `${map}/…` op R2.
- [ ] `voegVijandGifToe(client, kanaal, bericht, tekst, film, altTekst)`:
  - doet niets zonder `R2_BUCKET` of `bericht.ts`;
  - anders `naarGif` (480 breed), uploaden en `chat.update` met de blokken divider, section en image;
  - een fout wordt gelogd en daarna genegeerd.
- [ ] Gewone aanval: na de draadregel de film zonder await starten. Genadeslag: een nieuwe draadregel met de film. Kanon: de film achter het kanonbericht (beide takken).
- [ ] Rooktest met het nep-Slack-harnas uit de wapensessie: elke aanval roept `chat.update` aan met een image-blok (R2 vervangen door een nep-`fetch`).
- [ ] `npm test`; commit alleen de eigen hunks; push; deploy.
