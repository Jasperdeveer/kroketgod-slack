# Spoor 1: opruimen, implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De bot kleiner maken door de afgesproken functies weg te halen: de ronde van 2 november, Vetwissel, Profetie, Ambten en de Openbaring, Beurs, dode code en oude statebestanden. De voorrechten die aan de ambten hingen, gaan naar bestaande dagacties.

**Architecture:** Grotendeels weghalen, zowel in `index.js` als in `lib/`. Elk stuk krijgt zijn eigen commit in een vaste volgorde, zodat de tests na elke stap groen blijven. De Gouden Korst en de rangvoorrechten krijgen een nieuw effect op een bestaande plek (`legKaartSchorsingOp`, `RANGEN`).

**Tech Stack:** Node 20, Slack Bolt, `node:test`, het rooktest-harnas met nep-Slack (scratchpad `vijandgif/harnas.js` van de sessie van 17 nov).

**Spec:** docs/superpowers/specs/2026-11-17-kroketgod-compacter-en-autonoom-design.md (spoor 1)

## Global Constraints

- Een weggehaald commando geeft nooit een foutmelding. Het valt door naar `VERKONDIGINGEN` of naar een vrij antwoord van de Kroket God.
- De wroklaag blijft ongemoeid, op één regel na: `beurs` uit `SOLO_DADEN` in `lib/dubbelekorst.js`.
- Mijn uitnodigingsfix in `index.js` (`/^(invite|uitnodigen)(\s|$)/i`) gaat niet mee in een commit; de eigenaar zei "laat staan".
- Een functie die weggaat, gaat ook uit `BACKUP_BASIS` (`lib/backup.js`) en uit `registreerFeature`. Anders waarschuwt de bot bij elke opstart "Niet in de backup".
- Commit alleen eigen hunks naast ander werk (tijdelijke index, `git apply --cached`), test in een schone worktree, en push na elke commit. De repo is openbaar: scan op geheimen.
- Eén deploy aan het eind van het spoor. Controleer eerst met md5 wat de server draait, en kopieer alleen de veranderde bestanden.

## Review Focus

- Iemand typt `wissel`, `ambt`, `beurs`, `zegels` of `in iets`. Verwacht: een gewoon antwoord van de Kroket God, geen foutmelding en geen inning.
- De bot start op de server met de oude statebestanden er nog naast. Verwacht: geen crash en geen "Niet in de backup"-waarschuwing.
- Een lid met een actieve Gouden Korst krijgt een gele kaart. Verwacht: de kaart glijdt af, de Gouden Korst is op, en het bericht zegt dat. Zonder Gouden Korst gaat alles zoals nu.
- De weekreset op zondag 23:59 zonder Beurs. Verwacht: hij draait foutloos, de weekkampioen wordt profeet, en zakgeld en gulheid lopen zoals altijd.
- De App Home en `status` voor een lid van elke rang. Verwacht: geen lege of kapotte onderdelen waar ambten, beurs of wissels stonden, en de juiste offer- en eerlimiet per rang.

---

### Task 1: De ronde van 2 november afmaken

**Files:**
- Commit: de bestaande werkmapwijzigingen in `index.js`, `dashboard.html`, `lib/ambten.js`, `lib/backup.js`, `lib/commandoregister.js`, `lib/eerwaarde.js` en `lib/eerwaarde.test.js`, plus de al gestagede verwijderingen. Mijn invite-hunk gaat niet mee.
- Modify: `index.js`. Daar staan nog drie restjes: 'rechtbank' en 'stem' in `KORTAF_UITGESLOTEN` (rond `:1998`), de suggestie 'rechtbank [naam1] vs [naam2]' (rond `:6221`) en een los commentaar zonder code (rond `:8160`).

- [ ] Lees de diff van de werkmap door. Alles hoort bij de opruimronde van 2 november, behalve de invite-hunk.
- [ ] Haal de drie restjes weg.
- [ ] `npm test` moet groen zijn, en `node --check index.js` ook.
- [ ] Rooktest met het harnas: `rechtbank Alfa vs Bravo` en `stem Alfa` geven een gewoon antwoord van de Kroket God.
- [ ] Commit ("Opruimronde van 2 november afgemaakt") en push.

### Task 2: Vetwissel weg

**Files:**
- Delete: `lib/vetwissel.js`, `lib/vetwissel.test.js`
- Modify, in `index.js`:
  - import (rond `:54-60`);
  - commando's (`:8162-8245`);
  - de kern (`:12987-13379`);
  - de knoppen (`:16498-16536`). `meldKnopTerug` (`:16494-16497`) blijft staan, want de verbondsknoppen en Dubbel of niks gebruiken die ook;
  - de Home-regels in de wrok-kaart (`:16627-16645`, `:16660-16663`);
  - `CRON_LABELS` (`:10197-10198`) en de crons (`:23361-23377`);
  - `STILLE_COMMANDO_S` (`:6470`);
  - `wissels.json` en `wisselroem.json` uit de registratie van 'wrok' (`:16582`), en de feature-help (`:16585`).
- Modify: `lib/commandoregister.js:36-42`
- Modify: `lib/paarboek.js:57` (`wissel_geind` uit `DAAD_GEWICHT`)
- Test: `lib/paarboek.test.js:36-41` en `:393-410`

- [ ] Pas eerst de paarboektest aan: `DAAD_GEWICHT` heeft precies de sleutels `duel_verloren`, `eerbewijs`, `premie_geind` en `roof_gelukt`. Haal ook het testblok voor `wissel_geind` weg. Draai de test en zie hem falen.
- [ ] Haal de vetwissel weg op de plekken hierboven, inclusief `wissel_geind` in `lib/paarboek.js`.
- [ ] Haal de vervallen telActie-namen `wissel_verstrekt` en `wissel_afgelost` weg. Niets anders gebruikt ze.
- [ ] `npm test` en `node --check index.js` moeten groen zijn.
- [ ] Rooktest:
  - `in de pan` is een gewone vraag aan de Kroket God, geen inning;
  - `wissel Alfa 3` geeft geen foutmelding;
  - de App Home toont de wrok-kaart zonder wissels.
- [ ] Commit en push.

### Task 3: Profetie weg (de profeet blijft)

**Files, in `index.js`:**
- cron (`:21645-21671`) en label (`:10231`);
- de beoordeling in het weekoverzicht (`:10856-10862`, `:10873`);
- `profetie.json` uit `BACKUP_BASIS` (`lib/backup.js:24`).

Niet aanraken: `profeet.json`, `zegen` (`:7233-7281`) en de weekkampioen die profeet wordt. Die komen in spoor 3 terug.

- [ ] Haal de profetie weg.
- [ ] Het weekoverzicht van vrijdag 15:00 werkt zonder profetieën. Controleer de vangnettekst.
- [ ] `npm test` moet groen zijn.
- [ ] Rooktest: het weekoverzicht wordt gebouwd zonder fout, en `zegen Alfa` door de profeet werkt nog.
- [ ] Commit en push.

### Task 4: Ambten en de Openbaring weg, met nieuwe voorrechten

**Files:**
- Delete: `lib/ambten.js`, `lib/ambten.test.js`
- Modify, in `index.js` (bereiken uit de inventaris van 17 nov; zoek ze opnieuw op, want na task 2 en 3 schuiven de regels):
  - import (`:129-136`) en de kern (`:15984-16333`);
  - registratie, vacatures, hertelling, zegelverval en openbaring (`:16690-17189`);
  - vensters en knoppen (`:20737-20951`);
  - `ambt` en `ambtsboek` (`:8373-8435`), blad II (`:8331-8347`) en de verwijzing in de Vetgeschrift-tekst (`:8366`);
  - systeemprompt (`:3997-4017`, `:4045`, `:4060`);
  - het getuige-relikwie in `reaction_added` (`:10086-10096`);
  - `bumpVenster` en de aanroep ervan (`:3387-3400`, `:15843`);
  - de herautsplicht in de opdrachtmotor (`:15596-15598`, `:15738-15742`, `:15936-15939`, `HERAUT_BELONING_FACTOR`);
  - de Home-knoppen (`:19983-19995`) en de Boekenzegel-modal (`:20352-20354`);
  - de dashboardcases (`:23105-23132`);
  - crons (`:23340-23346`, `:23400-23427`) en de inhaalslag (`:23565-23590`);
  - `PASSIEVE_COMMANDO_S` (`:6427`) en `STILLE_COMMANDO_S` (`:6470`);
  - achievements 'zegelaar' en 'ambtsdrager' (`:3293-3294`);
  - `SEIZOEN_GEWICHT.ambtsdaad` (`:17393-17395`);
  - `RANGEN_EERSTE_CODEX`/`rangEersteCodex` (`:2296-2307`) en de optie `stil` van `pasRoemAan` (`:2425`), want die bestaan alleen voor de openbaring.
- Modify: `lib/commandoregister.js:97-99`. De categorie Vetgeschrift blijft.
- Modify: `RANGEN` en `getVoorrechten` (`index.js:2262-2376`).
- Modify: de Gouden Korst (`index.js:1723-1726`, de effecttekst `:15205`), de immuniteit (`:16092`) en `legKaartSchorsingOp` (`:3013`).

**Interfaces (Produces):**
- `getVoorrechten(userId)` geeft `{ eerExtra, offerExtra, duelExtra, winkelKorting, gunstAanwijzen, decreet }`, zonder `zegelExtra`.
- `legKaartSchorsingOp(userId, kleur, reden, citaat)` geeft `null` als een Gouden Korst de kaart opving (de korst is dan op), en anders het einde zoals nu.

Nieuwe voorrechten. Elke rang houdt zijn naam en drempel; alleen de zegels gaan eruit.

| Rang | Was | Wordt |
|---|---|---|
| Korsten (300) | 2 extra zegels, +1 per Korst | `offerExtra: 1`; per Korst boven de eerste `eerExtra` +1 |
| Kroon (210) | 1 extra zegel | `eerExtra: 1` |
| Meester der Ragout (55) | 20% korting en 1 extra zegel | 20% korting |
| Paneerknecht (15) | 1 extra zegel | `offerExtra: 1` |
| Volgeling der Korst (5) | 1 extra eer en "de volle ambtsnorm" | 1 extra eer (tekst zonder ambtsnorm) |
| Aspirant (0) | 1 zegel minder | geen voorrechten |

De Gouden Korst wordt: "24 uur: een gele kaart die op u landt, glijdt van u af — en gouden status in de ranglijst".

- [ ] Leg in een rooktest de huidige limieten per rang vast: `offerLimiet` en `eerLimiet` voor roem 0, 5, 15, 55, 210, 300 en 500. Pas ze daarna aan naar de verwachting volgens de tabel. Ze falen.
- [ ] Rooktest voor de Gouden Korst. Geef UA een `gouden_korst` en laat de Raad een gele kaart voor UA aannemen. Verwacht: geen kaart in `geleKaarten.json`, geen schorsing, de powerup is weg, en het bericht noemt de Gouden Korst. Bij UB zonder korst gaat het zoals nu.
- [ ] Haal de ambten weg op de plekken hierboven.
- [ ] Pas `RANGEN`, `getVoorrechten` en de Korst-tekst aan (`rangVolgende`: "nóg een eerbewijs per dag").
- [ ] Laat `legKaartSchorsingOp` de Gouden Korst controleren en `null` teruggeven. Zoek alle aanroepers (gele-kaartstemming, vergrijpen, rode kaart) en laat ze `null` afhandelen met een eigen regel.
- [ ] `npm test`, `node --check index.js` en beide rooktests moeten groen zijn. Toets `vetgeschrift rangen` en de App Home op leegtes.
- [ ] Commit en push.

### Task 5: Beurs weg

**Files:**
- Delete: `lib/beurs.js`, `lib/beurs.test.js`
- Modify, in `index.js`:
  - import (`:73-81`), commando (`:7900-7938`) en de kern (`:15214-15560`);
  - Home-knop `beurs_koop_*` (`:20997-21008`) en status (`:18247-18269`, `:18444-18452`);
  - de afrekening in de weekreset (`:21862-21873`, `:21905-21910`);
  - de opdracht `w-beurs` (`:15593`) en de dashboardcase `beursDecreet` (`:23089`).
- Modify: `dashboard.html:759`; `lib/dubbelekorst.js:32` (`beurs` uit `SOLO_DADEN`) en zijn test als die de lijst controleert.
- Verbanning-check in `lib/beurs.js:74` verdwijnt mee.

- [ ] Rooktest voor de weekreset: roep de weekkampioen-cron aan op een state zonder `beurs.json`. Hij draait foutloos en zet de profeet.
- [ ] Haal de beurs weg.
- [ ] `npm test`, `node --check index.js` en de rooktest moeten groen zijn. Toets ook dat `beurs` een gewoon antwoord geeft.
- [ ] Commit en push.

### Task 6: Dode code weg

**Files:** alleen `index.js` en `lib/`.
- Nooit aangeroepen: `vervallenWisselVan` (weg na task 2) en `CASINO_BEZIG`.
- Imports die niemand gebruikt: `BACKUP_BASIS`, `WISSEL_MAX_OPEN`, `STANDAARD_INSTELLINGEN`, `weefselWarmte`, `weefselWrijving`, `toestandVan`, `bladzijdeVan`, `nettoGulheid`, `parseerKlasse`, `KERF_MAX`, `INZET_MAX` en `verbondNaarOpslag`.
- Constanten die niemand leest:
  - `GUNST_PER_PERSOON_PER_WEEK` (`lib/gunst.js:22`);
  - `KERF_PER_DAG` (`lib/paar.js:46`);
  - `BOEKINGEN_PER_DAG` (`lib/paarboek.js:68`).

Lib-functies die alleen een test gebruikt, blijven staan. Ze zijn de spec van een regel.

- [ ] Zoek elke naam opnieuw met `grep`, en haal hem alleen weg als hij echt nergens meer gebruikt wordt.
- [ ] `npm test` en `node --check index.js` moeten groen zijn.
- [ ] Commit en push.

### Task 7: Deploy en oude statebestanden

**Files:** op de server, in `~/kroketgod`.

- [ ] Vergelijk met md5 de serverbestanden met de laatste gedeployde commit (ae0153e).
- [ ] Kopieer de veranderde bestanden uit een schone worktree van de laatste commit.
- [ ] Verwijder de weggehaalde lib-bestanden ook op de server.
- [ ] Herstart de bot.
- [ ] De log heeft "wakker", geen fouten en geen "Niet in de backup". De health is healthy.
- [ ] Maak een back-up van de oude statebestanden in een map `~/kroketgod/oud-2026-11-17/`, en haal ze daarna uit de werkmap. Het gaat om:
  - `kroniek.ndjson` en `stemmen.json`;
  - `wissels.json` en `wisselroem.json`;
  - `profetie.json` en `beurs.json`;
  - `ambten.json`, `ambtsboek.json`, `venstertellers.json` en `openbaring.json`.
- [ ] Herstart opnieuw en controleer de log nog een keer.
- [ ] Werk het geheugen bij (inventaris en spellen): wat er weg is, en de nieuwe voorrechten.
