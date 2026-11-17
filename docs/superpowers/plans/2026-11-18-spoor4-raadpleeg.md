# Spoor 4: `raadpleeg`, implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eén commando, `raadpleeg`, met vier rituelen die elk een klein gevolg in het spel hebben: horoscoop, biecht, orakel en canonisatie. Er komt een knop "Raadpleeg" in de App Home. De losse tekstcommando's verdwijnen uit de menu's; hun woorden werken nog als vrije vraag. De bot heet vanaf nu Kroket God 5.0, en dat staat in de App Home en in de help.

**Architecture:** De regels staan in een nieuwe, pure module `lib/raadpleeg.js`: rituelen, daglimieten, trekkingen, de controle van voorspellingen en boetes, en de canonisatie. `index.js` doet de rest:
- het leest en schrijft `raadpleeg.json`;
- het voert de rituelen uit en kondigt ze aan;
- het hangt haken in `voerDuel` (horoscoop), `telActie` (orakel en boete) en `reaction_added` (canonisatie);
- het toont de rituelen in de App Home.

Uitbetalen gaat via `betaalNawerking` van de regisseur (spoor 2).

**Tech Stack:** Node 20, Slack Bolt, `node:test`, het rooktest-harnas (`scripts/rooktest/harnas.js`).

**Spec:** docs/superpowers/specs/2026-11-17-kroketgod-compacter-en-autonoom-design.md, sectie "Spoor 4: tekstcommando's, minder en leuker".

## Beslissingen

Wat de spec openlaat, ligt hier vast:

- **Horoscoop: kans, geen punten.** Het teken is gunstig of ongunstig. Dat verschuift de winkans in het eerstvolgende duel van vandaag met +0,10 of −0,10, of het lid nu uitdager of doelwit is. Zo komen er geen punten bij en gaan er geen af, dus er is geen plafond of nulgrens nodig. De horoscoop staat openbaar in het kanaal: anderen weten wie vandaag pech heeft en kunnen daarop inspelen.
- **Verbruik:** de horoscoop wordt verbruikt op het moment dat een duel echt beslist wordt, voor beide duellisten. Een geweigerd duel (balling, bondgenoot, daglimiet, duelverbod) verbruikt niets. De verschuiving staat los van `getGeluk`, dus roof en troonstrijd merken er niets van.
- **Orakel:** de code kiest de voorspelling, niet het taalmodel. Ze gaat altijd over een ander lid (geen balling, niet afwezig), nooit over de vrager zelf. De controle gebeurt bij de daad zelf, via `telActie`: doet het voorspelde lid vandaag de voorspelde daad, dan krijgt de vrager 1 punt. Om middernacht vervalt de voorspelling stil. Is er geen ander lid, dan volgt alleen een antwoord.
- **Biecht:** vrijspraak of een boetedoening. De boete is een mini-opdracht: één daad uit een vaste lijst, vóór middernacht. Hij staat in de opdrachtenkaart van de App Home, wordt via dezelfde `telActie`-haak afgevinkt en levert 1 punt op. Vrijspraak heeft geen gevolg: een schoon geweten. Een boete is dus een kans op een punt.
- **Canonisatie:** een lid draagt een ander lid voor. Anderen bevestigen met :innocent: (😇) op het bericht. Bij 2 bevestigers, die niet de voorsteller of de kandidaat zijn, is de kandidaat Heilige van de Dag, tot middernacht. Een voordracht staat 2 uur open. Er is één heilige per dag. De titel geeft geen punten: hij staat in de App Home en in het dossier, zodat de Kroket God de heilige zo aanspreekt. De heilige komt niet in `TITELS`, want die zijn afneembaar en geven roem.
- **Daglimieten:** per lid per dag één horoscoop, één biecht, één orakel en één voordracht. Een geweigerde poging (lege vraag, onbekende naam, al een heilige) telt niet.
- **State:** één bestand, `raadpleeg.json`. De dagwissel gebeurt bij het lezen (`dagStaat`), zonder cron en zonder `setTimeout`. Een herstart verandert dus niets.
- **Punten:** alleen via `betaalNawerking` (id `orakel` of `biecht`). Dat deelt bewust het geefplafond van de regisseur (15 per dag, eerst uit de Schatkist). Is er geen ruimte, dan is er geen punt maar wel een regel in het bericht. Spoor 4 neemt nooit punten af. De uitbetalingen staan daardoor ook op de dashboardkaart van de regisseur.
- **App Home:** een kaart "Raadpleeg de Kroket God" met een knop `open_raadpleeg`. Die opent het bestaande commandovenster: `bouwCommandoModal(RAADPLEEG_SJABLOON, …)`, en het bestaande `home_cmd_modal` voert het uit. Er komt geen nieuwe view-handler. `/kroketgod raadpleeg` zonder ritueel opent hetzelfde venster.
- **Oude woorden:** de handlers gaan weg, dus de woorden vallen door naar de vrije vraag. Voor `horoscoop`, `biecht`, `orakel` en `canoniseer` komt er eerst een korte tip naar `raadpleeg`. `stuurMop` en `stuurKroketFeitje` blijven bestaan.
- **Openbaar:** elk ritueel post in het kanaal. De biecht logt anoniem in het weekoverzicht, zoals nu.
- **5.0:** de constante `KROKETGOD_VERSIE = '5.0'` staat in `index.js` en verschijnt in de App Home (raadpleegkaart en voetregel) en in de kop van de help. `package.json` blijft zoals het is. Er komt geen aankondigingscode: de controller plant de aankondiging zelf.

## Global Constraints

- **Afhankelijkheid:** bouwt op spoor 2 (`betaalNawerking`, `regie.ruimte`, het harnas). Werk op een eigen branch `spoor4-raadpleeg`, vertakt nadat spoor 2 is samengevoegd.
- **Waarden:**

  | Wat | Waarde |
  |---|---|
  | Horoscoop gunstig | `rng() < 0.6` |
  | Verschuiving per teken | 0,10 |
  | Biecht vrijspraak | `rng() < 0.4`, anders een boete |
  | Beloning boete, beloning orakel | 1 punt elk, via `betaalNawerking` |
  | Bevestig-emoji | `innocent` |
  | Drempel canonisatie | 2 bevestigers |
  | Voordracht open | 2 uur (`7_200_000` ms) |
  | Rituelen per lid per dag | elk 1 |

- **Dag:** `dagSleutel()` (`en-CA`, Amsterdam). Alles van gisteren telt niet meer.
- **State:** `raadpleeg.json` in `registreerFeature({ naam: 'raadpleeg', state: ['raadpleeg.json'], help })`. Lezen, verwerken en schrijven zonder `await` ertussen, zodat twee gelijktijdige daden elkaar niet overschrijven. Posten gebeurt pas daarna.
- **Onvertrouwde tekst:** de vraag en de zonde gaan via `wrapOnvertrouwd` de prompt in.
- **Tekst:** elke tekst van het taalmodel gaat via `kroketResponseMetVangnet`, met een vaste zin. De spelregel (teken, boete, voorspelling, drempel) is een vaste coderegel onder de tekst, dus die staat er ook zonder taalmodel.
- **Wie mag:** alleen leden. De bestaande poorten blijven gelden: buitenstaander, DM, kanaal, weekendrust en verbanning.
- **Rooktests:** zet vóór het eerste commando `weekendRust: false` in `instellingen.json`, anders faalt de test in het weekend. Seed `raadpleeg.json` met de datum van vandaag (`en-CA`, Amsterdam), en gebruik voor "gisteren" die datum min één dag.
- **Werkwijze:** commit per task op de spoor-branch, en push pas na de eindreview. De repo is openbaar: scan op geheimen. De controller deployt.

## Review Focus

- **Dagwissel en herstart.** Een horoscoop, voorspelling, boete of heilige van gisteren. Verwacht: na middernacht telt niets daarvan nog, en iedereen kan weer elk ritueel doen. Na een herstart midden op de dag geldt alles nog. Vastgepind in task 1 (`een nieuwe dag begint leeg`, `gisteren betaalt niets`), in task 3 (een horoscoop van gisteren wordt niet verbruikt) en in task 4 (de heilige van gisteren staat niet in de Home).
- **Eén keer uitbetalen.** Het voorspelde lid offert twee keer, de biechteling eert drie leden tegelijk, of iemand zet twee keer een 😇. Verwacht: één punt en één aankondiging van de heilige. Voorsteller en kandidaat tellen niet mee, en het orakel voorspelt nooit iets over de vrager. Vastgepind in task 1 en in de rooktests van task 3 en 4.
- **De plafonds.** De regisseur gaf vandaag al 15 punten. Verwacht: een uitgekomen voorspelling geeft geen punt, maar wel de regel dat de Schatkist leeg is. Ze telt als uitgekomen en betaalt later niet alsnog. Vastgepind in task 3.
- **De duelhaak.** Een geweigerd duel verbruikt de horoscoop niet. Een beslist duel verbruikt die van beide duellisten, in de goede richting. Vastgepind in task 3: bij `Math.random() = 0.55` wint UA met gunstige sterren, en zonder sterren verliest hij.
- **Oude woorden en menu's.** Elk geschrapt woord komt bij de vrije vraag uit, zonder foutmelding en zonder de tekst van de oude handler. Geen menu, help, suggestie of bingovakje noemt ze nog. Zonder taalmodel post elk ritueel toch een vaste zin met de spelregel eronder. Vastgepind in task 5 (unit en rooktest) en task 2 (vangnet).

---

### Task 1: `lib/raadpleeg.js`, de pure kern

**Files:** Create `lib/raadpleeg.js` en `lib/raadpleeg.test.js`.

**Interfaces (Produces):**
- State `raadpleeg.json`:
  ```
  { datum: 'YYYY-MM-DD',
    leden: { [userId]: {
      horoscoop?: { teken: 'gunstig'|'ongunstig', verbruikt: false },
      biecht?:    { uitkomst: 'vrijspraak'|'boete', boete: null | { actie, tekst }, voldaan: false },
      orakel?:    { doel: userId|null, actie, tekst, uitgekomen: false },
      voordracht?: true } },
    heilige: null | { kandidaat, voorsteller, ts, kanaal, tot, bevestigers: [], heilig: false } }
  ```
- Constanten:
  - `RITUELEN = ['horoscoop', 'biecht', 'orakel', 'canoniseer']`;
  - `RAADPLEEG_SJABLOON = 'raadpleeg horoscoop|biecht|orakel|canoniseer ([vraag, zonde of naam])'`;
  - `HOROSCOOP = { kansGunstig: 0.6, delta: 0.1 }`, `BIECHT = { kansVrijspraak: 0.4, beloning: 1 }`, `ORAKEL = { beloning: 1 }`, `HEILIG = { emoji: 'innocent', drempel: 2, openMs: 7_200_000 }`.
- `BOETES`, elk `{ actie, tekst, raid? }`:
  - `eer_gegeven` "Eer vandaag een medelid";
  - `offer` "Offer vandaag aan het Grote Vetbad";
  - `kroketje_gegeven` "Geef vandaag een :lekker_kroketje: aan een medelid";
  - `gunst` "Gun vandaag een medelid een punt";
  - `raid_aanval` "Val vandaag de weekvijand aan" (`raid: true`).
- `VOORSPELLINGEN`, elk `{ actie, tekst, raid? }`, met `{naam}` in de tekst:
  - `duel_gewonnen` "{naam} wint vandaag een duel";
  - `offer` "{naam} offert vandaag aan het Grote Vetbad";
  - `eer_gegeven` "{naam} eert vandaag een medelid";
  - `winkel_koop` "{naam} doet vandaag een aankoop in de Aflatenhandel";
  - `raid_aanval` "{naam} valt vandaag de weekvijand aan" (`raid: true`).
- Functies, allemaal puur. `rng` is injecteerbaar, en `staat` is al door `dagStaat` gegaan:
  - `dagStaat(staat, datum)` geeft bij een andere datum een verse dag (`{ datum, leden: {}, heilige: null }`), en anders dezelfde staat.
  - `parseRaadpleeg(tekst)` geeft `{ ritueel: RITUELEN-lid|null, rest }`. Hoofdletters tellen niet.
  - `oudRitueel(tekst)` geeft het ritueel als het eerste woord een ritueelwoord is, en anders `null`.
  - `openRituelen(staat, userId)` geeft de rituelen die dit lid vandaag nog kan doen, in de volgorde van `RITUELEN`. `canoniseer` valt weg na een eigen voordracht of als er al een heilige is.
  - `trekHoroscoop(staat, userId, rng)` geeft `{ staat, teken }` of `{ fout: 'al_gedaan' }`.
  - `pakSterren(staat, uitdagerId, doelId)` geeft `{ staat, delta, tekens: [{ id, teken }] }`. `delta` is het eigen teken van de uitdager min dat van het doel, en beide worden verbruikt.
  - `biecht(staat, userId, rng, { raidActief })` geeft `{ staat, uitkomst, boete }` of `{ fout: 'al_gedaan' }`.
  - `orakel(staat, userId, rng, { kandidaten, raidActief })` geeft `{ staat, voorspelling: { doel, actie, tekst } | null }` of `{ fout: 'al_gedaan' }`.
  - `verwerkActie(staat, userId, actie)` geeft `{ staat, uitbetalingen: [{ soort: 'orakel'|'boete', aan, tekst }] }`.
  - `draagVoor(staat, { voorsteller, kandidaat, nu, ts, kanaal })` geeft `{ staat }` of `{ fout: 'zelf'|'al_gedaan'|'al_heilige'|'open_voordracht' }`. Een verlopen voordracht (`nu >= tot`) maakt plaats.
  - `bevestig(staat, { userId, ts, nu })` geeft `{ staat, nieuwHeilig }`. Of de bevestiger lid is en geen balling, controleert `index.js` vooraf.
  - `heiligeVandaag(staat)` geeft een `userId` of `null`.

- [ ] Tests (`lib/raadpleeg.test.js`), elk met een vaste `rng`:
  - **`een nieuwe dag begint leeg`:** een staat met een horoscoop en een heilige onder `datum: '2026-11-17'` geeft met `'2026-11-18'` lege `leden` en `heilige: null`. Met dezelfde datum blijft alles staan.
  - **`parseRaadpleeg en oudRitueel`:**
    - `'raadpleeg Orakel wordt het wat'` geeft `{ ritueel: 'orakel', rest: 'wordt het wat' }`;
    - `'raadpleeg'` en `'raadpleeg dans'` geven `ritueel: null`;
    - `oudRitueel('horoscoop')` geeft `'horoscoop'`, en `oudRitueel('orakelachtig')` en `oudRitueel('raadpleeg orakel')` geven `null`.
  - **`het sjabloon geeft de juiste commandotekst`:** `bouwCommandoTekst(RAADPLEEG_SJABLOON, ['orakel', 'wordt het wat'])` geeft `'raadpleeg orakel wordt het wat'`, en met `['horoscoop', '']` geeft het `'raadpleeg horoscoop'`.
  - **`horoscoop: één per dag`:** `rng` 0,59 geeft gunstig en 0,6 ongunstig. Een tweede trekking geeft `al_gedaan`.
  - **`sterren: beide kanten, goede richting`:**
    - A gunstig en B ongunstig geeft `delta` +0,2 (A daagt uit) en −0,2 (B daagt uit);
    - alleen A ongunstig geeft −0,1;
    - een tweede `pakSterren` geeft 0;
    - zonder horoscoop geeft het 0, en de staat blijft gelijk.
  - **`biecht`:** `rng` 0,39 geeft vrijspraak zonder boete. Bij 0,5 volgt een boete. De `raid_aanval`-boete komt alleen bij `raidActief`. Een tweede biecht geeft `al_gedaan`.
  - **`orakel`:** het doel is nooit de vrager, ook als die in `kandidaten` staat. Zonder kandidaten is de voorspelling `null`, maar het ritueel telt wel. De raid-voorspelling komt alleen bij `raidActief`.
  - **`verwerkActie: één keer`:**
    - het orakel van UA over UB/`offer` betaalt UA bij `verwerkActie(staat, 'UB', 'offer')`, één keer;
    - een tweede offer geeft niets, net als een andere actie of een ander lid;
    - de boete van UC/`eer_gegeven` betaalt UC één keer.
  - **`gisteren betaalt niets`:** een voorspelling onder de datum van gisteren, door `dagStaat` van vandaag, levert bij de juiste actie niets op.
  - **`canonisatie: voordragen`:**
    - zichzelf voordragen geeft `zelf`;
    - een tweede voordracht van dezelfde voorsteller geeft `al_gedaan`;
    - een open voordracht van een ander geeft `open_voordracht`, en na `tot` lukt een nieuwe;
    - na een heilige geeft het `al_heilige`.
  - **`canonisatie: bevestigen`:**
    - voorsteller en kandidaat tellen niet;
    - UC twee keer telt één keer;
    - UD maakt het heilig, met `nieuwHeilig: true` precies één keer, en UE daarna geeft `false`;
    - een verkeerde `ts` of `nu >= tot` telt niet.
  - **`openRituelen`:** het begint met alle vier en krimpt per gedaan ritueel. `canoniseer` valt weg als iemand anders vandaag heilig werd.
- [ ] Draai de tests: ze falen.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 2: Het commando en drie rituelen

**Files:**
- Modify `index.js`:
  - `const raadpleeg = require('./lib/raadpleeg.js')`, en `registreerFeature({ naam: 'raadpleeg', state: ['raadpleeg.json'], help: [{ gebruik: '/kroketgod raadpleeg', verwacht: 'horoscoop (geluk of pech in uw volgende duel), biecht (vrijspraak of een boetedoening, +1), orakel (een voorspelling; komt die uit, +1) of canoniseer [naam] (heilige van de dag). Elk 1×/dag' }] })`.
  - `raadpleegStaat()` geeft `raadpleeg.dagStaat(readJSON('raadpleeg.json', {}), dagSleutel())`. `bewaarRaadpleeg(staat)` schrijft het bestand.
  - `openRaadpleegVenster(client, triggerId)` doet `client.views.open` met `bouwCommandoModal(raadpleeg.RAADPLEEG_SJABLOON, <uitleg>, [])`.
  - In `voerKroketCommandoUit`:
    - direct na de casino-tak: `raadpleeg` zonder ritueel en zonder rest opent het venster. Met een onbekend ritueel volgt een ephemeral met de vier rituelen.
    - na de ontvangstbevestiging (vóór `uitbreken`): `raadpleeg <ritueel> …` gaat naar `voerRitueelUit`. Een niet-lid krijgt een ephemeral weigering.
  - `voerRitueelUit(client, { userId, ritueel, rest, channelId, respond, rng = Math.random })` gaat via `RITUEEL_UITVOERDERS[ritueel]`. Een `fout` uit de kern wordt een ephemeral (al gedaan, lege vraag) en telt niet. Een ritueel zonder uitvoerder (`canoniseer`, tot task 4) geeft de ephemeral met de rituelen.
  - De uitvoerders:
    - **`horoscoop`:** de tekst na het woord negeert hij, want het is altijd uw eigen horoscoop. Vangnet: gunstig `🔭 _De sterren boven de frituur staan gunstig voor {naam}. Het vet is helder, de korst houdt._`, ongunstig `🔭 _De sterren boven de frituur staan scheef voor {naam}. Het vet spat; wees op uw hoede._`. Coderegel: `🔭 *Gunstig* · in het eerstvolgende duel van vandaag weegt de kans 10% in het voordeel van *{naam}*.` of de ongunstige tegenhanger.
    - **`biecht`:** een lege zonde geeft een ephemeral. Na de LLM-tekst volgt bij een boete de coderegel `🕯️ *Boetedoening voor {naam}:* {tekst}. Volbracht vóór middernacht: +1 kroketpunt.` Daarna `logGebeurtenis('biecht', null, …)`, zoals nu.
    - **`orakel`:** een lege vraag geeft een ephemeral. Kandidaten zijn leden zonder de vrager, `!isVerbannen`, `!isAfwezig`. `raidActief` komt uit `bamischijf.json`. Coderegel: `🔮 *Voorspelling:* {tekst}. Komt die uit, dan krijgt *{vrager}* 1 kroketpunt.`
  - Rooktest-export: voeg `voerRitueelUit`, `raadpleegStaat` en `bewaarRaadpleeg` toe.
- Create `scripts/rooktest/raadpleeg-rituelen.js`.

- [ ] Rooktest (zonder taalmodel, dus altijd het vangnet):
  - **Horoscoop:** met `Math.random = () => 0.1` geeft `commando('UA', 'raadpleeg horoscoop')` een post met de vangnetzin en `*Gunstig*`, en `raadpleeg.json` heeft `leden.UA.horoscoop.teken === 'gunstig'`. Een tweede keer geeft een ephemeral en geen nieuwe post.
  - **Biecht:** `raadpleeg biecht` zonder zonde geeft een ephemeral en schrijft niets. Met `Math.random = () => 0.9` geeft `raadpleeg biecht ik at ketchup` een post met `Boetedoening voor`, en de state heeft een boete.
  - **Orakel:** `raadpleeg orakel wordt het wat` geeft een post met `Voorspelling`, en `leden.UA.orakel.doel` is een ander lid dan UA.
  - **Venster:** `raadpleeg` opent een `views.open` met `callback_id: 'home_cmd_modal'` en `private_metadata === RAADPLEEG_SJABLOON`. `raadpleeg dans` noemt de vier rituelen.
  - **Balling:** met UA in `verbanning.json` doet `raadpleeg horoscoop` niets aan de state.
- [ ] Implementeer. Draai `npm test` en de rooktest.
- [ ] Commit.

### Task 3: De gevolgen in het spel

**Files:** `index.js`.
- **`voerDuel`:** direct vóór `let winnaarIsUitdager = …` haalt `sterrenVoorDuel(userId, doelId)` (lezen, `pakSterren`, schrijven) `{ delta, regel }` op. `delta` komt bij de kans in dezelfde expressie als het geluk. Na `maakNaspel` volgt `naspelRegel(naspel, regel)` als er een regel is: `🔭 De sterren wogen mee: Alfa (gunstig, +10%), Bravo (ongunstig, −10%).`
- **`telActie`:** direct na `bumpTeller`, in een eigen `try` zoals de Dubbele Korst, `await raadpleegNaActie(client, userId, actie, naspel)`. Die leest, doet `verwerkActie` en schrijft, en betaalt daarna per uitbetaling `betaalNawerking({ id: soort === 'orakel' ? 'orakel' : 'biecht', doel: aan, punten: 1 })`. Daarna volgt een regel via `naspelRegel` of `postToChannel`:
  - orakel: `🔮 Het orakel van *{vrager}* kwam uit: _{tekst}_. +1 kroketpunt.`;
  - boete: `🕯️ *{naam}* deed boete: _{tekst}_. De zonde is vergeven: +1.`;
  - bij 0 uitbetaald staat er `REGIE_GEEN_RUIMTE` achter in plaats van +1.
- **Opdrachtenkaart** (`registreerFeature({ naam: 'opdrachten' … }).home`): heeft het lid vandaag een boete, dan komt er een extra regel onder "OPDRACHTEN VAN VANDAAG": `> 🕯️ Boetedoening: {tekst} — *+1*`, of na voldoen `> ✅ ~Boetedoening: {tekst}~ — *+1* geïnd`.
- **`bouwAppHomeBlocks`, `eretitels`:** een onverbruikte horoscoop wordt `🔭 Horoscoop: {gunstig|ongunstig} voor uw volgende duel vandaag`. Een open voorspelling wordt `🔮 Uw voorspelling: {tekst}`.
- Rooktest-export: `bouwAppHomeBlocks`.

Create `scripts/rooktest/raadpleeg-gevolgen.js`. Zet UA en UB op 10 punten en leeg `duels.json`, zoals `regie-grillen.js` doet.

- [ ] Rooktests:
  - **Geweigerd duel:** met UA gunstig en UC verbannen weigert `voerDuel(UA, UC)`, en de horoscoop van UA is nog onverbruikt.
  - **Duel met sterren:** met `Math.random = () => 0.55` en UA gunstig wint UA van UB. Beide horoscopen zijn verbruikt, en een draadpost bevat `🔭`. Als controle: dezelfde opzet zonder horoscoop (een verse dag, scores teruggezet) laat UA verliezen.
  - **Gisteren:** een gunstige horoscoop van UD onder de datum van gisteren wordt in een duel niet verbruikt, en er komt geen `🔭`-regel.
  - **Orakel:** met het orakel van UA over UB/`offer` en `commando('UB', 'offer 1')` heeft `regie.json` een nawerking `{ id: 'orakel', doel: 'UA', punten: 1 }`, en er staat een post of draadregel met `🔮`. Een tweede offer van UB geeft geen tweede nawerking.
  - **Boete:** met de boete van UC/`offer` en `commando('UC', 'offer 1')` volgt één nawerking `{ id: 'biecht', doel: 'UC', punten: 1 }`.
  - **Plafond:** met het regie-log van vandaag op 15 gegeven en het orakel van UE over UB komt er geen nawerking, en het bericht bevat de tekst van `REGIE_GEEN_RUIMTE`. `uitgekomen` is `true`.
  - **Home:** `bouwAppHomeBlocks('UC')` bevat `Boetedoening`, en `bouwAppHomeBlocks('UA')` bevat `Horoscoop` zolang de horoscoop niet is verbruikt.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 4: Canonisatie

**Files:**
- `scripts/rooktest/harnas.js`: `handlers.event` vangt `app.event(naam, fn)` op als een lijst per naam, plus de helper `gebeurtenis(naam, event)` op `h`, die alle handlers met `{ event, client }` draait. Eén regel in `README.md`.
- `index.js`:
  - **De uitvoerder `canoniseer`** in `RITUEEL_UITVOERDERS`:
    - zoek de kandidaat met `getMemberByNaam(rest)`; die moet een lid zijn en geen balling;
    - toets met `draagVoor` op een verse lezing en gooi de uitkomst weg; bij een `fout` volgt een ephemeral;
    - post de LLM-tekst met het vangnet `😇 _{voorsteller} draagt {kandidaat} voor als heilige van de dag. Het genootschap beslist._` en de coderegel `😇 Bevestig met :innocent:. Bij *2* bevestigingen van anderen is *{kandidaat}* vandaag heilig (de voordracht staat 2 uur open).`;
    - schrijf daarna `draagVoor(…, { ts: res.ts, kanaal })` op een verse lezing. Zonder `res.ts` gebeurt er niets;
    - leg `reactions.add` met `innocent` op het bericht, in een `.catch(() => {})`, zoals bij het gastendebat.
  - **`reaction_added`:** direct na `if (event.user === event.item_user) return;`:
    `if (event.reaction === raadpleeg.HEILIG.emoji && await bevestigHeilige(client, event)) return;`
    `bevestigHeilige` controleert dat de bevestiger lid is en geen balling. Daarna leest hij, doet `bevestig` en schrijft. Bij `nieuwHeilig` post hij een vaste tekst, zonder taalmodel: `✨ *{kandidaat} is de Heilige van de Dag.* Het genootschap heeft gesproken; de Kroket God spreekt {kandidaat} tot middernacht als heilige aan.` Dan volgt `logGebeurtenis('heilige', kandidaat, …)`. Hij geeft `true` als de reactie bij de voordracht hoorde.
  - **`eretitels`:** `😇 Heilige van de Dag — tot middernacht` voor wie `heiligeVandaag` is.
  - **`bouwDossierBlok`:** na de titels de regel `is vandaag de Heilige van de Dag, bevestigd door het genootschap`.
  - Rooktest-export: `bouwDossierBlok`.
- Create `scripts/rooktest/raadpleeg-heilige.js`.

- [ ] Rooktests:
  - **Voordragen:** `commando('UA', 'raadpleeg canoniseer Bravo')` geeft een post met `:innocent:`, en `heilige.kandidaat === 'UB'` met de `ts` van die post. `raadpleeg canoniseer Alfa` van UA wordt geweigerd.
  - **Bevestigen:**
    - een 😇 van UA en van UB telt niet;
    - UC twee keer (andere `event_ts`) telt één keer;
    - UD maakt UB heilig, met één `✨`-post;
    - een 😇 van UE daarna geeft geen tweede post.
  - **Een tweede voordracht:** `raadpleeg canoniseer Delta` van UC wordt geweigerd, want er is al een heilige.
  - **Titel:** `bouwAppHomeBlocks('UB')` en `bouwDossierBlok('UB')` bevatten `Heilige van de Dag`.
  - **Gisteren:** een heilige onder de datum van gisteren staat niet in de Home van UB.
- [ ] Implementeer.
- [ ] Groen. Commit.

### Task 5: De menu's opruimen

**Files:**
- `lib/commandoregister.js`:
  - Haal weg: `orakel [vraag]`, `advies`, `weer`, `feitje`, `quiz` (de admin-regels `quiz starten` en `quiz onthul` blijven), `mop`, `bs`, `hoelang`, `vrijdag`, `gebod [1-10]`, `biecht [zonde]`, `complot`, `slachtoffer`, `horoscoop [naam]`, `straf [naam]`, `bekeer [naam]`, `canoniseer [naam]`, de therapie, de spirit-kroket en `meld [naam]`.
  - Voeg in "🔮 Rituelen & mysteriën" toe: `{ cmd: RAADPLEEG_SJABLOON, uitleg: 'horoscoop, biecht, orakel of canonisatie; elk ritueel heeft een gevolg in het spel (elk 1×/dag)' }`.
  - Verhuis de lijst `SUGGESTIES` uit de `prompts`-tak hierheen en exporteer hem:
    - haal elke regel weg die begint met een geschrapt woord (zie de testlijst);
    - voeg toe: `raadpleeg horoscoop`, `raadpleeg biecht ik heb ketchup gebruikt`, `raadpleeg orakel wordt het vandaag een goede kroketdag`, `raadpleeg canoniseer [naam]`;
    - regels in gewone taal ("schrijf een kroket-huwelijksaanzoek", "debat ketchup bij kroket", "wat zou Aristoteles zeggen over de kroket") blijven, want ze werken als vrije vraag.
- `lib/commandoregister.test.js`, met `GESCHRAPT = ['orakel','horoscoop','bs','mop','biecht','canoniseer','slachtoffer','gebod','bekeer','hoelang','vrijdag','weer','feitje','quiz','complot','meld','advies','quote','nieuws','straf']`.
- `index.js`:
  - Haal deze takken in `voerKroketCommandoUit` weg: `vrijdag`, `complot`, `feitje`, `mop` (met de `vertel een mop`-varianten), `hoelang`, `biecht`, `quiz` (alleen de OpenTDB-tak), `gebod`, `bekeer`, `orakel`, `horoscoop`, `slachtoffer`, `meld`, en `weer` (met `weersverwachting`). Haal ook `VERKONDIGINGEN`, `vindVerkondiging`, `voerVerkondiging` en de aanroep ervan weg.
  - Haal de helpers weg die daarna nergens meer aangeroepen worden. Controleer dat eerst met grep: `haalAdvies`, `haalCorporateBs`, `haalAmsterdamsWeer`, `haalWttrData`, `GEBODEN_LIJST`, `getVerdachtheidsscore`, `loadVerdacht` en `saveVerdacht`. Deze blijven: `haalTriviaVraag` (de Kroket Quiz), `maakVrijdagCountdownZin` (mentions), `getUitverkorene`, `GEBODEN_TEKST`, `stuurMop` en `stuurKroketFeitje`. `verdacht.json` blijft in `BACKUP_BASIS` (spoor 1c).
  - De `prompts`-tak gebruikt `SUGGESTIES` uit het register.
  - `STILLE_COMMANDO_S`: `horoscoop` eruit. `KORTAF_UITGESLOTEN`: `raadpleeg` erbij.
  - `BINGO_POOL`, drie vakjes, en de pool blijft 12:
    - "Vraag de Kroket God om een orakel-uitspraak" wordt "Raadpleeg het orakel en zie de voorspelling uitkomen";
    - "Biecht een kroket-zonde op die u nog nooit heeft gedeeld" wordt "Biecht via raadpleeg een kroket-zonde op die u nog nooit heeft gedeeld";
    - "Vraag de horoscoop op en handel ernaar" wordt "Win een duel op een gunstige horoscoop".
  - De vrije vraag: als `raadpleeg.oudRitueel(input)` iets geeft, volgt vóór de LLM-aanroep `respond` (ephemeral) met `_Dit is nu een ritueel met een gevolg in het spel: \`/kroketgod raadpleeg {ritueel}\`. Uw woorden gaan nu als vrije vraag naar de Kroket God._`
  - Rooktest-export: `BINGO_POOL`.
- Create `scripts/rooktest/raadpleeg-oude-woorden.js`.

- [ ] Unit tests (`lib/commandoregister.test.js`):
  - **`raadpleeg staat erin, de geschrapte woorden niet`:** precies één item heeft `cmd === RAADPLEEG_SJABLOON`. Geen niet-admin-commando begint met een woord uit `GESCHRAPT`.
  - **`suggesties: geen geschrapt woord vooraan`:** geen regel in `SUGGESTIES` begint met een woord uit `GESCHRAPT`, en precies 4 regels beginnen met `raadpleeg`.
  - De bestaande tests blijven groen: één blok per categorie, elk commando precies één keer, en `homecommandos.test.js` over de modals van het hele register.
- [ ] Rooktest:
  - **Elk woord bij de vrije vraag:** voor elk woord in `['orakel','orakel wordt het wat','horoscoop','bs','mop','vertel een mop','biecht ik at ketchup','canoniseer Bravo','slachtoffer','gebod 11','bekeer Bravo','hoelang','vrijdag','weer','feitje','quiz','complot','meld Bravo','advies','straf Bravo','rap de snackleer']` eindigt het antwoord van `commando('UA', woord)` op de vaste melding van de vrije vraag (`tijdelijk overbelast`, want het harnas heeft geen taalmodel). Het bevat geen `Onbekend commando` en geen oude handlertekst (`Tien Geboden`, `Geordende Kring`, `Wie meldt u aan`, `onvoldoende bewijs`, `examenvraag`, `Het Orakel zwijgt`).
  - **Tip:** `horoscoop`, `biecht ik at ketchup`, `orakel wordt het wat` en `canoniseer Bravo` bevatten `raadpleeg {ritueel}`. `vrijdag` bevat geen tip.
  - **Bingo:** `BINGO_POOL` heeft 12 vakjes en bevat de drie nieuwe teksten.
  - **Help:** `commando('UA', 'help')` bevat `/kroketgod raadpleeg`, en geen `/kroketgod {woord}` voor een woord uit `GESCHRAPT`.
- [ ] Implementeer. `node --check index.js`, `npm test`, en alle rooktests in `scripts/rooktest/` blijven groen.
- [ ] Commit.

### Task 6: Kroket God 5.0 en de knop in de App Home

**Files:** `index.js`. Create `scripts/rooktest/raadpleeg-home.js`.
- `const KROKETGOD_VERSIE = '5.0';` bovenaan bij de vaste constanten, buiten elke tabel die bij het laden al geëvalueerd wordt (zie de TDZ-noot bij `COMMANDO_LIJST`).
- `buildHelpText`: de kop wordt `⚜️ *KROKET GOD ${KROKETGOD_VERSIE}* ⚜️`.
- `bouwAppHomeBlocks`: na `perkamentHomeBlocks` en alleen als het lid geen balling is, één `section`:
  - de tekst `🔱 *Raadpleeg de Kroket God* · _versie ${KROKETGOD_VERSIE}_`;
  - daaronder `Vandaag nog: {openRituelen, met " · " ertussen; canoniseer heet hier canonisatie}`;
  - als accessory de knop `{ action_id: 'open_raadpleeg', text: 'Raadpleeg', style: 'primary' }`;
  - is `openRituelen` leeg, dan staat er in plaats daarvan `_U heeft vandaag alles gevraagd. Morgen spreekt hij weer._`, zonder knop.
  Dat is één blok erbij; `kapHomeBlocks` blijft de grens bewaken.
- De voetregel van de Home begint met `Kroket God ${KROKETGOD_VERSIE} · `.
- `app.action('open_raadpleeg', …)`: `ack`, dan `openRaadpleegVenster(client, body.trigger_id)` in een `try`, met een `console.error` zoals bij `open_visioen`.

- [ ] Rooktests:
  - **Kaart:** `bouwAppHomeBlocks('UA')` bevat `open_raadpleeg`, `Raadpleeg de Kroket God`, `versie 5.0` en een voetregel met `Kroket God 5.0`.
  - **Knop:** `klik('open_raadpleeg', 'UA')` geeft een `views.open` met `private_metadata === RAADPLEEG_SJABLOON`.
  - **Alles gedaan:** met alle vier de rituelen van UA vandaag in de state staat er geen `open_raadpleeg` meer, wel `Morgen spreekt hij weer`.
  - **Balling:** met UA verbannen staat de kaart er niet.
  - **Help:** `commando('UA', 'help')` bevat `KROKET GOD 5.0`.
- [ ] Implementeer.
- [ ] Eindcontrole: `npm test` en alle rooktests in `scripts/rooktest/` groen. Een grep op `input === '<woord>'` en `input.startsWith('<woord>` levert voor geen enkel woord uit `GESCHRAPT` nog iets op.
- [ ] Commit. De deploy en de aankondiging doet de controller.
