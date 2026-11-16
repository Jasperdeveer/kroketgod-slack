# Het Frituurarsenaal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leden kopen wapens en leggen in het Frituurkanon tegen de weekvijand, met de balans uit de spec.

**Architecture:** Pure regels in `lib/wapens.js` (catalogus, rek, uithaal, kanon), net als `lib/weekvijand.js`. De bedrading (winkel, aanval, raidbord, beurt, afrekening) staat in `index.js`. Wapenstaat leeft in de raid (`raid.arsenaal`, `raid.kanon`, `raid.pekel`, `raid.folie` in `bamischijf.json`).

**Tech Stack:** Node 20, Slack Bolt, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-16-wapens-weekvijand-design.md`

## Global Constraints

- Prijzen: frietvork 1, kroketmes 3, vliegenmepper 2, ovenwant 2, vershoudfolie 2, pekelspuit 3, vetbom 5.
- Rek: 2 wapens per lid per vijand, één tegelijk in de hand; vetbom 1 per lid per vijand.
- Kanon: doel 12 punten, minstens 3 leden, schade `round(maxHp × 0.15)`, één keer per vijand.
- HP per lid 8,5. Alle code en teksten in het Nederlands, in de stijl van de omliggende code.
- Commit alleen eigen hunks; de werkmap bevat andermans niet-gecommitte opruimwerk.

## Review Focus

- Kopen zonder actieve vijand of na de deadline: weigeren met een duidelijke reden.
- Kopen met een vol rek of met al een wapen in de hand: weigeren, geen punten afschrijven.
- Vetbom die terugketst bij een saldo van 0 of 1: neem hooguit wat er is.
- Kanoninleg die precies het doel haalt maar met maar 2 leden: niet vuren, wel bewaren.
- Kanon dat de genadeslag geeft: overwinning loopt via de gewone afrekening, één keer.

---

### Task 1: `lib/wapens.js`, de regels

**Files:** Create `lib/wapens.js`, `lib/wapens.test.js`.

**Interfaces (produces):**
- `WAPENS` `{ key: { naam, icoon, prijs, uitleg } }`, `WAPENREK_MAX = 2`, `KANON_DOEL = 12`, `KANON_MIN_LEDEN = 3`, `KANON_FRACTIE = 0.15`.
- `zwakTegen(gaveSoort) -> wapenKey|null` (pantser→kroketmes, ontwijk→vliegenmepper, stekels/hebzucht/kortlontje/explosief→ovenwant, taai/hongerig→vershoudfolie, samen→pekelspuit, offerdoof/dikhuid/wraakzucht/plunderaar→null).
- `koopWeigering(eigen, key, saldo) -> string|null` met `eigen = { inHand, gekocht, vetbom }`.
- `wapenUithaal(basis, key, gave, worp) -> { basis, gave, terugslag, knal, folie, pekel, ketst }`: de basisschade en de gave waarmee `schadeNaGave` daarna rekent.
- `kanonVuurt(kanon) -> boolean`, `kanonSchade(maxHp) -> number`.

- [ ] Tests: elk wapen in de catalogus heeft prijs en uitleg; rek vol / in de hand / tweede vetbom / te weinig saldo geweigerd; kroketmes +2 en gave pantser vervalt; vliegenmepper vervalt ontwijk; ovenwant zet terugslag en knal uit; vetbom 3–9 en ketst bij worp < 1/6; kanon vuurt bij 12 van 3 leden, niet van 2; kanonschade 15%.
- [ ] Implementeer, `node --test lib/wapens.test.js` slaagt, commit.

### Task 2: Aanval, beurt en afrekening

**Files:** Modify `index.js` (`voerBamischijfAanval`, `beslechtBamischijfOverwinning`, `weekvijandBeurt`), `lib/weekvijand.js` (HP_PER_LID 8.5), `lib/weekvijand.test.js`.

- [ ] Aanval gebruikt het wapen in de hand (Task 1), wist het daarna, past pekel van een ander toe, zet `raid.folie`/`raid.pekel`.
- [ ] Vershoudfolie: `weekvijandBeurt` slaat herstel over en wist `raid.folie`.
- [ ] Overwinning: inleg uit `raid.arsenaal[uid].uitgegeven` terug naar elk lid.
- [ ] HP-test: `maxHpVoor(6, 1) === 51`.

### Task 3: Kopen, kanon en raidbord

**Files:** Modify `index.js` (`koop`-commando, `winkel`-tekst, App Home-winkel, `bouwRaidBlocks`, acties).

- [ ] `koopWapen(client, userId, key)` en `legInKanon(client, userId, n)`; kanon dat vuurt kan de genadeslag geven.
- [ ] Raidbord: oorlogskas, kanonstand, bewapende strijders, tip "Zwak tegen", keuzelijsten `wapen_kies` en `kanon_inleg`.
- [ ] Rooktest met een nepraid, `npm test` slaagt, commit, push.
