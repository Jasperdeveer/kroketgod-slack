# Spoor 2: de regisseur, implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De Kroket God grijpt op werkdagen zelf in. Hij geeft, neemt, sluit het casino, legt grillen op, spreekt mensen aan, mengt zich in de weekvijand, en zorgt een paar keer per week voor een grote verrassing. Er gelden harde plafonds, en elke ingreep staat zichtbaar op het dashboard.

**Architecture:** De pure kern staat in `lib/regie.js`: het regieboek als data, de kiezer, de plafonds, de effecten en de Schatkist. `index.js` doet de rest:
- het bouwt de stand (`bouwRegieStand`);
- het tikt elke 20 minuten (`regieTik`);
- het voert ingrepen uit (`voerIngreepUit`);
- het zet haken in casino, duel, winkel, eer, Raad, berichten en weekvijand.

De state staat in `regie.json`.

**Tech Stack:** Node 20, Slack Bolt, `node:test`, het rooktest-harnas (`scripts/rooktest/harnas.js`, task 2).

**Spec:** docs/superpowers/specs/2026-11-17-spoor2-regisseur-design.md

## Global Constraints

- **Plafonds per dag**, alle lagen samen:
  - hoogstens 15 punten gegeven;
  - hoogstens 10 punten genomen, en hoogstens 5 per lid;
  - hoogstens 1 schorsing;
  - nooit onder nul.
- **Niveaus:**

  | Niveau | Kans per tik | Ingrepen per dag |
  |---|---|---|
  | `uit` | 0 | 0 |
  | `laag` | 0,08 | 2 |
  | `normaal` (standaard) | 0,15 | 4 |
  | `wild` | 0,25 | 7 |

- **Tempo:** minstens 45 minuten tussen twee ingrepen. Geen lid twee keer per dag als doelwit. Geen lid twee dagen op rij gestraft.
- **Verrassingen:** kans 0,03 per tik. Hoogstens 2 per week, nooit 2 op één dag, en dezelfde niet binnen 21 dagen.
- **Praatjes:** hoogstens 1 per werkdag, in een eigen baan. Ze tellen niet voor het dagbudget.
- **Tijdvenster:** alleen werkdagen, 8:30-17:30 Amsterdam. Nooit bij `stilModus`, bij `alleenTestkanaal`, of in het weekend bij `weekendRust`.
- **Wie nooit doelwit is:** ballingen, wie afwezig is (`afwezigTot`) en gasten.
- **Bescherming:** de Zegen van de Paneerlaag (powerup `'zegen'`) maakt immuun voor elke puntenstraf van de regisseur; hij spot dan. De Gouden Korst (`'gouden_korst'`) vangt zijn schorsing op en wordt daarbij verbruikt.
- **Schatkist:** genomen punten gaan erin. Geschenken komen eerst eruit; de rest wordt binnen het geefplafond geschapen.
- **Schorsing:** een kale verbanning van 1 uur, zonder kaart.
- **Dagsleutels:** `dagSleutel()` geeft `en-CA` (`2026-11-17`); de raid en duels gebruiken `nl-NL` (`17-11-2026`). Gebruik per bestand het formaat dat daar al staat.
- **Bestanden:** elk nieuw statebestand in `registreerFeature`. Elke nieuwe instelling in `STANDAARD_INSTELLINGEN`, met validatie.
- **Aankondigen:** elke ingreep wordt aangekondigd door de Kroket God, via `kroketResponseMetVangnet` met een vaste vangnetzin. Een straf noemt altijd de reden.
- **Werkwijze:** commit per task op de spoor-branch, en push pas na de eindreview. De repo is openbaar: scan op geheimen. Deploy aan het eind, met een md5-controle.

## Review Focus

- **Afgelopen effect.** Een lid speelt een open casinohand af terwijl het casino dichtgaat, of het effect loopt af terwijl het venster open staat. Verwacht: de hand bevriest (zoals nu bij `casinoAan=false`), en na afloop speelt hij gewoon verder.
- **Herstart midden in een effect of verrassing.** Het casino is dicht, of de Hete Kroket loopt. Verwacht: na de herstart geldt het effect nog tot dezelfde eindtijd, en de Hete Kroket ontploft of loopt door op basis van `regie.json`, niet op een `setTimeout`.
- **De plafonds bij elkaar opgeteld.** Ingreep, verrassing, overrule en het Omgekeerde Uur op dezelfde dag. Verwacht: samen nooit meer dan 10 genomen of 15 gegeven, en niemand onder nul.
- **Een doelwit met bescherming.** Een lid met een Zegen wordt belast. Verwacht: geen puntenverlies en een spottende regel. Een lid met een Gouden Korst wordt geschorst. Verwacht: geen ban, de korst is op, en het bericht zegt dat.
- **Stille modus of weekend.** Verwacht: geen enkele ingreep, verrassing of praatje. De knop "laat hem nu iets doen" in het dashboard respecteert alleen de plafonds en slaat het tijdvenster over, dus die werkt ook buiten werktijd. Dat is bedoeld.

Elk van deze vijf staat als rooktest in de task die de code bevat.

---

### Task 1: `lib/regie.js`, de pure kern

**Files:** Create `lib/regie.js` en `lib/regie.test.js`.

**Interfaces (Produces):**
- State `regie.json`:
  ```
  {
    schatkist: n,
    effecten: [{ id, soort, tot, data }],
    log: [{ ts, id, laag: 'ingreep'|'verrassing'|'praatje', doel, punten, soort }],
    verrassing: null | {...}
  }
  ```
  `tot` en `ts` zijn epoch-ms.
- `REGIEBOEK` is een array van:
  ```
  { id, laag, soort: 'geven'|'nemen'|'casino'|'gril'|'toespraak'|'weekvijand'|'verrassing'|'praatje',
    gewicht, afkoelUren, maxPerDag, punten, duurMinuten, schorsing?,
    voorwaarde(stand) -> bool, kiesDoel(stand, rng) -> userId|null, opdracht }
  ```
- `NIVEAUS` = `{ uit, laag, normaal, wild }`, met per niveau `{ kans, perDag }`.
- `kiesIngreep(stand, staat, { nu, rng, niveau, forceer })` geeft `{ ingreep, doel }` of `null`.
  - `forceer` slaat de kans en het tijdvenster over, niet de plafonds.
  - Het verwerkt alle drie de lagen in deze volgorde: verrassing (eigen kans), dan ingreep, dan praatje.
- `ruimte(staat, nu)` geeft `{ geven, nemen, nemenVan(id), schorsing }`.
- `effectActief(staat, soort, nu)` geeft het effect of `null`. Verder: `voegEffectToe(staat, effect)` en `ruimOp(staat, nu)`, die verlopen effecten weghaalt en het log tot 21 dagen terugbrengt.
- `betaal(staat, punten)` geeft `{ staat, uitSchatkist, geschapen }`. `stort(staat, punten)` geeft de nieuwe staat.
- `boek(staat, keuze, { nu, punten })` geeft de staat met een nieuwe logregel.
- De stand (komt uit task 2):
  ```
  { nu, leden: [{ id, score, actiefVandaag, werkdagenStil, verbannen, afwezig, gast,
                  zegen, goudenKorst, geleKaartDezeWeek, vergrijpVandaag,
                  casino: { spellen, netto, winreeks }, duelGewonnenVandaag }],
    casino: { spellenVandaag, open },
    raid: { actief, hp, maxHp, weekdag, strijders, leden, extraAanvalVandaag },
    kanaal: { laatsteLidBerichtMs }, weekdag, minuutVanDag }
  ```

Het regieboek bevat alle ingrepen, verrassingen en praatjes uit de spec, met hun voorwaarden en doelen. Het effect zelf staat niet in deze module.

- [ ] Tests (`lib/regie.test.js`), elk met een vaste `rng` en `nu`:
  - **Niveau en venster:** niveau `uit` geeft altijd `null`. Buiten het venster (een zaterdag, of 18:00) ook `null`, tenzij `forceer`.
  - **Tempo:** binnen 45 minuten na de laatste ingreep komt `null`. Het dagbudget per niveau wordt gerespecteerd (4 ingrepen bij normaal, de vijfde geeft `null`).
  - **Doelwitten:** een doelwit van vandaag wordt niet nog eens gekozen. Wie gisteren gestraft werd, krijgt vandaag geen straf.
  - **Plafonds:**
    - na 10 genomen punten geen `nemen`-ingreep meer;
    - de belasting op een lid met 3 punten neemt hoogstens 3;
    - na één schorsing geen tweede.
  - **Wie geen doelwit kan zijn:** ballingen, afwezigen en gasten zijn nooit doelwit.
  - **Verrassingen:** hoogstens 2 per week, niet op dezelfde dag, en dezelfde niet binnen 21 dagen.
  - **Praatjes:** hoogstens 1 per werkdag, en ze tellen niet voor het dagbudget.
  - **Schatkist:** `betaal` haalt eerst uit de Schatkist en schept de rest. `stort` verhoogt de Schatkist.
  - **Effecten:** `effectActief` herkent een effect vóór `tot` en niet meer na `tot`. `ruimOp` haalt verlopen effecten weg en kort het log in tot 21 dagen.
  - **Gewogen keuze:** met een `rng` die 0 of 0,999 teruggeeft, worden de eerste en de laatste kandidaat gekozen.
  - **Voorwaarden:** per ingreep uit de spec één test dat de voorwaarde klopt. Voorbeeld: de belasting alleen als de koploper 15 of meer punten voorstaat.
- [ ] Draai de tests: ze falen.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 2: Het geraamte in `index.js`, plus het harnas in de repo

**Files:**
- Create: `scripts/rooktest/harnas.js` en `scripts/rooktest/README.md`, uit `/private/tmp/claude-501/-Users-jasperdeveer-Projects-kroketgod-slack/5d289af3-2409-4795-8ab2-f96bd97daa92/scratchpad/spoor2/harnas/harnas.js` en `harnas-uitleg.md` (de seed-state staat ernaast), met de `commando(...)`-helper erin.
- Modify:
  - `lib/instellingen.js`: `regieNiveau: 'normaal'`, plus validatie. `saveInstellingen` weigert waarden buiten `uit|laag|normaal|wild`. Test in `lib/instellingen.test.js`.
  - `index.js`:
    - `registreerFeature({ naam: 'regisseur', state: ['regie.json'] })`;
    - `mogAutonoomPosten()`, die `false` geeft bij stille modus, bij alleen-testkanaal en bij weekendrust in het weekend;
    - `werkdagenStil(userId)`, die alleen ma-vr telt, vanaf `laatsteBericht` en `laatsteDaad` in `activiteit.json`;
    - `bouwRegieStand()`;
    - `regieTik(client, { forceer })`;
    - `voerIngreepUit(client, keuze, stand)`, die per `ingreep.id` naar een uitvoerder gaat, de Kroket God laat aankondigen via `kroketResponseMetVangnet`, en `boek` + `logAudit('regie', …)` doet;
    - `planCron('*/20 8-17 * * 1-5', …)` met een label in `CRON_LABELS`.
  - Eerste werkende ingreep: **Het Huis geeft**. Lees de bonus van vandaag eerst en tel er 3 bij op, met `voerCasinoBeheerUit({ soort: 'bonus', aantal })`.

**Interfaces (Produces):**
- `voerIngreepUit` is een uitvoerderstabel `UITVOERDERS[id] = async (client, keuze, stand) -> { feiten, reden, knoppen? }`. Elke volgende task voegt daar uitvoerders aan toe.
- `regieStaat()` en `bewaarRegie(staat)` lezen en schrijven `regie.json`.

- [ ] Rooktest (`scripts/rooktest/regie-geraamte.js`):
  - een geforceerde tik op een maandag om 11:00 met lege state: "Het Huis geeft" verschijnt, `casinobonus.json` staat op +3, `regie.json` heeft een logregel en het auditlog een regel;
  - met `stilModus`: niets;
  - op zaterdag zonder `forceer`: niets.
- [ ] Implementeer. Draai `npm test` en de rooktest.
- [ ] Commit.

### Task 3: Casino-effecten

**Files:** `index.js`:
- `casinoToegangReden`: geeft "dicht tot HH:MM" terug zolang het effect `casinoDicht` loopt.
- Dezelfde check in de Home-casinoknop, het limietblok, `casinoDashboardData().aan` en de casinoroddel.
- `casinoMax()`: ×2 bij het effect `hogeTafel`.
- `boekCasinoUitslag`, op de eerste regel:
  - bij `goudenUur` en een winst: `uitbetaling = inzet + netto + min(5, ceil(netto*0.5))`;
  - bij `omgekeerdUur` (task 8 zet dat effect): winst en verlies wisselen, met hoogstens 5 per spel.
- De `melding` in `casinoVenster`.
- Uitvoerders voor `hogeTafel`, `casinoDicht` (2 of 3 uur, nooit na 16:30 starten) en `goudenUur`.

- [ ] Rooktests:
  - **Dicht:** met het casino dicht weigert `open_casino`, en zeggen `casino` en de zet-handler "dicht tot …". Na `tot` werkt het weer.
  - **Hoge tafel:** de maximale inzet is ×2.
  - **Gouden uur:** een gewonnen spel betaalt de extra winst uit, met hoogstens 5.
  - **Herstart midden in "dicht":** het blijft dicht tot dezelfde tijd.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 4: De macht

**Files:** `index.js`. Uitvoerders voor:
- **`belasting`:** 10% van de weekscore, minstens 2 en hoogstens 5, en nooit meer dan iemand heeft of dan `ruimte.nemenVan` toelaat. Het gaat naar de Schatkist.
- **`beslag`:** 3 punten naar de Schatkist.
- **`schorsing`:** een kale verbanning van 1 uur. Schrijf `verbanning[id] = { tot, reden, citaat: null, dagen: null, opgelegd }` en `saveVerbanning`, zonder kaart en zonder het verbond mee te slepen.

Elke straf controleert eerst de Zegen (straf ketst af, spottende regel, de Zegen blijft). De schorsing controleert ook de Gouden Korst (die wordt verbruikt).

De overrule-haak zit in `sluitGeleKaartPoll`, direct na `const toegekend = …` en vóór het opslaan:
- met kans 0,2 draait hij de uitslag om, hoogstens 1 keer per week;
- alleen als de plafonds het toelaten;
- hij zet `poll.uitslag.regisseur = true` en kondigt het aan zonder de aanklager te noemen.

- [ ] Rooktests:
  - **Belasting:** de koploper heeft 40 punten en nummer twee 20. De belasting neemt 4, en de Schatkist wordt 4.
  - **Zegen:** dezelfde belasting op een lid met een Zegen neemt niets; de Zegen blijft, en het bericht spot.
  - **Schorsing:** het lid is een uur een balling, zonder kaart in `geleKaarten.json`.
  - **Gouden Korst:** dezelfde schorsing op een lid met een Gouden Korst geeft geen ban, en de korst is op.
  - **Overrule:** dwing een stemming af met `rng = 0`. De uitslag draait om, wordt in de poll vastgelegd, en de aanklager staat niet in het bericht.
  - **Plafonds:** belasting plus beslag op één dag samen nooit meer dan 10.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 5: Grillen

**Files:** `index.js`:
- `voerDuel`: weigert tijdens `duelverbod`, na de verbanningscheck en vóór het schrijven van state. De omkering bij `omgekeerdUur` keert `winnaarIsUitdager` om, vóór de destructuring, met hoogstens 5. Een gegarandeerde winst uit `pakFortuin` gaat vóór de omkering.
- `winkelPrijs(userId, item)`: ×2 bij `inflatie`, min 1 (minimum 1) bij `uitverkoop`. Voeg een reden toe in `prijsRedenen`. Pas de twee vergelijkingen met `w.prijs` (het `winkel`-commando en de Home-winkel) aan, zodat een opslag niet als korting verschijnt.
- `voerEer`: bij `dubbeleEer` promoveert `basisKlasse` één trede met `promoveerKlasse`, voor iedereen, zodat de aankondiging klopt.
- Uitvoerders voor `duelverbod` (2 uur), `inflatie`, `uitverkoop` en `dubbeleEer` (elk 1 uur).

- [ ] Rooktests:
  - **Duelverbod:** een duel wordt geweigerd, met de tijd tot het verbod afloopt.
  - **Prijzen:** bij inflatie kost een item van 2 er 4, en de winkeltekst toont dat als opslag. Bij uitverkoop kost een item van 1 nog steeds 1.
  - **Dubbele eer:** de eer is één klasse hoger.
  - **Omgekeerd uur:** het verlies van een duel levert punten op, met hoogstens 5.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 6: Toespraken en praatjes

**Files:** `index.js`. Uitvoerders voor:
- **`persoonlijkeGunst`:** een stil lid krijgt een knop `regie_gunst`, met een looptijd van 1 uur in de state. Drukt het lid binnen die tijd, dan krijgt het 2 punten via `betaal`.
- **`koploperUitdaging`:** een knop `regie_uitdaging`, met een looptijd van 2 uur. Wint de hekkensluiter binnen die tijd een duel van de koploper, dan krijgt die 3 punten extra. Dat is een haak in de duelafrekening.
- **`loterijGevuld`:** do/vr vóór de trekking. Voeg loten toe op naam van een echt lid dat al meedoet, zodat de pot groeit zonder een nepdeelnemer. Zet dat in een commentaar.
- **`praatje`:** kies uit `casinoRoddel()`, `maakKroketFeitje()` en de inhoud van `maybeSpontaan`, zonder de kansregels van die functies.

Haal de crons `30 16 * * 2`, `30 7 * * 1-5`, `0 10 * * 2,4` en `0 14 * * 2,4` weg, met hun labels.

- [ ] Rooktests:
  - **Knop van de gunst:** binnen het uur geeft hij 2 punten, daarna geeft hij een vriendelijke weigering.
  - **Uitdaging:** wint de hekkensluiter het duel tegen de koploper, dan krijgt die 3 extra.
  - **Praatje:** een geforceerd praatje post tekst.
  - **Crons:** de vier crons bestaan niet meer, en het dashboard toont hun labels niet.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 7: De weekvijand

**Files:** `index.js` en `lib/vijandbeeld.js`.
- **`extraAanvalsdag`:** zet `raid.extraAanval` op de dagsleutel in `nl-NL`, en daarna `updateRaidBericht`.
- **`bliksem`** (een verrassing):
  - Een schicht van 15% van maxHP, met dezelfde boeking als het kanon. Bij `hp <= 0` volgt de overwinning, zoals bij de genadeslag.
  - Of een heling van 10%, als de vijand vóór woensdag onder de 30% staat.
  - Een nieuwe `bliksemFilm(opties)` in `lib/vijandbeeld.js`, gebouwd op de bestaande scène (een schicht van boven, inslag, HP-balk). De vijand plaatst die via `stuurVijandGif`. Test in `lib/vijandbeeld.test.js`: rendert, en eindigt op de juiste HP.

- [ ] Rooktests:
  - **Extra aanvalsdag:** op woensdag, met de vijand op 70% en 2 van de 6 leden die vochten, zet de ingreep `extraAanval`, en mag een lid twee keer aanvallen.
  - **Bliksem:** de HP daalt met 15%.
  - **Genadeslag:** een schicht als genadeslag geeft de overwinning.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 8: De verrassingen

**Files:** `index.js`. De state van een lopende verrassing staat in `regie.json` onder `verrassing`, nooit in een `setTimeout`. Een minuutklok `planCron('* * * * *', regieKlok)` handelt verlopen tijden af.

- **`heteKroket`:**
  - Een knop `regie_hete_kroket` "Geef door" opent een keuze van een lid.
  - Na 30 minuten moet hij doorgegeven zijn, met +10 minuten per keer doorgeven. Na 90 minuten ontploft hij: wie hem vasthoudt, verliest 3 aan de Schatkist (de Zegen beschermt), en wie hem het vaakst doorgaf, krijgt 1.
  - Wordt hij niet op tijd doorgegeven, dan ontploft hij meteen.
  - Het bericht wordt bijgewerkt met de houder en de tijd.
- **`flitsopdracht`:** een pool met controleerbare opdrachten:
  - een bericht met een woord (haak in de message-handler);
  - een gewonnen duel (haak in de duelafrekening);
  - een offer (haak in offer).

  De eerste die het doet, krijgt 3. Na 10 minuten vervalt de opdracht.
- **`raadsel`:** een pool met vaste antwoorden in `lib/regie.js`. Het juiste antwoord in de draad van het raadselbericht geeft 5 (haak in de message-handler op `thread_ts`, hoofdletterongevoelig, genormaliseerd). Na een uur verklapt hij het antwoord.
- **`stadhouder`:** een actief lid krijgt drie knoppen, `regie_stad_casino`, `regie_stad_belasting` en `regie_stad_gunst`. Eén keuze, die 1 uur geldig is. Ze gebruiken de bestaande uitvoerders en tellen mee voor de plafonds.
- **`herverdeling`:** van de twee hoogsten elk 10%, hoogstens 4 per lid, naar de twee laagsten. Alleen bij een verschil van meer dan 40.
- **`archiefSpreekt`:**
  - Voeg nu in `logBericht` en in de backfill `thread: !!thread_ts` toe aan de archiefregel.
  - Kies alleen `soort: 'lid'` met `thread === false`, van 29 tot 31 dagen geleden, en nooit van vóór `gedeeldSinds()`.
  - Zonder geschikte regel is de voorwaarde `false`. Dat betekent dat de verrassing pas ongeveer een maand na de deploy voor het eerst kan komen.
- **`omgekeerdUur`:** zet het effect dat task 3 en task 5 lezen.
- **`puntenregen`:** de volgende 3 leden die een bericht sturen, krijgen elk 1 (haak in de message-handler).
- **`woedeBijStilte`:** de voorwaarde is drie uur geen lidbericht op een werkdag. Er volgt een dreiging van 15 minuten. Zegt een lid binnen die tijd iets, dan krijgt die 1. Anders verliest iedereen 1 (de Zegen beschermt, en het telt voor de plafonds).

- [ ] Rooktests, per verrassing één:
  - **Hete Kroket:** doorgeven verlengt de tijd; ontploffen kost 3; een herstart in het midden houdt de tijd.
  - **Flitsopdracht:** de eerste met het woord krijgt 3, de tweede niets.
  - **Raadsel:** het juiste antwoord in de draad geeft 5.
  - **Stadhouder:** de knop sluit het casino.
  - **Herverdeling:** het geld gaat van rijk naar arm.
  - **Archief spreekt:** zonder geschikte regel niets; met een geseede regel van 30 dagen terug een citaat.
  - **Puntenregen:** drie berichten geven drie punten.
  - **Woede bij stilte:** een bericht binnen 15 minuten geeft 1; zonder bericht verliest iedereen 1.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 9: Het dashboard

**Files:** `index.js` en `dashboard.html`.
- In `bouwDashboardData`: `regie: { niveau, schatkist, vandaag: [...log], effecten: [...lopend], verrassing }`.
- In `voerDashboardActie`:
  - `regisseurNu`, dat `regieTik({ forceer: true })` doet en meldt wat er gebeurde;
  - `regieEffectStop`, dat met `{ id }` het effect weghaalt.
- In `dashboard.html`:
  - een kaart "Wat de Kroket God vandaag deed", met de ingrepen van vandaag, de lopende effecten met een knop "beëindig", de Schatkist en een knop "laat hem nu iets doen";
  - in `renderInstellingen` een `<select id="i_regieNiveau">`, en het veld `regieNiveau` in de expliciete veldenlijst van `saveInstellingen`.

- [ ] Rooktests:
  - **Stats:** `/api/stats` bevat `regie`.
  - **Effect stoppen:** `regieEffectStop` haalt een effect weg, en het casino is meteen weer open.
  - **Niveau:** opslaan met `regieNiveau='wild'` werkt, en met `'gek'` niet.
  - **Nu:** `regisseurNu` doet een ingreep, ook op zaterdag.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 10: Eindcontrole en deploy

- [ ] Draai `npm test` en alle rooktests in `scripts/rooktest/`.
- [ ] Laat de regisseur een gesimuleerde werkweek draaien: een tik per 20 minuten op een kopie van de echte state, met een vaste `rng`. Tel de ingrepen, verrassingen en punten per dag. Ze moeten binnen de plafonds blijven.
- [ ] Na de eindreview: samenvoegen met de live branch, pushen en deployen (md5-controle, alleen de veranderde bestanden). Controleer daarna de log: wakker, geen fouten, geen "Niet in de backup".
- [ ] Werk het geheugen bij.
