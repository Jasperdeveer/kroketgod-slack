# Spoor 3: terugbrengen in het spel, implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elf weinig gebruikte functies komen terug in het spel. Dat gebeurt langs twee wegen. Deel A voegt dagopdrachten, weekopdrachten en een bingovakje toe, met een `telActie` op de plek waar de daad gebeurt. Deel B geeft de regisseur tien nieuwe ingrepen. Hij zet premies uit, deelt stille missies uit en draagt zelf een ketter voor een gele kaart voor. Hij roept ook een licht tribunaal bijeen, houdt zegen-, verbonds- en seizoensdagen, opent een klachtenuur, schenkt genade aan een balling met berouw en heeft soms een vrijgevige bui. Waar een opdracht een gelegenheid nodig heeft, lokt hij die uit.

**Architecture:**
- Deel A raakt alleen de opdrachtenmotor in `index.js`: `OPDRACHTEN`, `kiesOpdrachten`, `opdrachtHaalbaar`, `opdrachtTekst` en negen haken.
- Deel B volgt het patroon van spoor 2. Elke ingreep is één regel in `REGIEBOEK` (`lib/regie.js`, puur, met tests) en één uitvoerder in `UITVOERDERS` (`index.js`). `bouwRegieStand` levert de nieuwe velden aan.
- Alles wat de regisseur uitbetaalt, loopt via `betaalNawerking` of `neemNawerking` en dus via `ruimte()` en de Schatkist.
- State staat in bestaande bestanden: `regie.json`, `premie.json`, `missie.json` en `gelekaartpoll.json`. Er komt geen nieuw statebestand bij.

**Tech Stack:** Node 20, CommonJS, Slack Bolt, `node:test`, het rooktest-harnas (`scripts/rooktest/harnas.js`).

**Spec:**
- `docs/superpowers/specs/2026-11-17-kroketgod-compacter-en-autonoom-design.md`, de sectie "Spoor 3" en de intro;
- `docs/superpowers/specs/2026-11-17-spoor2-regisseur-design.md`;
- de regels P1-P24 in `.superpowers/sdd/2026-11-17-spoor2-regisseur/globale-eisen.md`, die hier ook gelden.

**Vereist:** spoor 2 staat live (taken 1-10), met de minuutklok `regieKlok` uit taak 8. Werk op de branch `spoor3-terugbrengen`, afgetakt van de live branch na de deploy van spoor 2.

## Beslissingen

Dit staat niet in het ontwerp, of alleen in grote lijnen. Het zijn keuzes van de planner, niet van de eigenaar.

### Nieuwe opdrachten (deel A)

| id | soort | actie | doel | beloning | tekst |
|---|---|---|---|---|---|
| `d-zegen` | dag | `gezegend` | 1 | 2 | Laat u zegenen door de profeet of op een zegendag |
| `d-seizoen` | dag | `seizoen_daad` | 3 | 1 | Drijf {dreiging} terug met drie daden in de frituur |
| `w-raad` | week | `raad_stem` | 1 | 3 | Stem mee in de Raad over een gele kaart |
| `w-genade` | week | `begenade` | 1 | 4 | Help een balling terug met begenade |
| `w-klacht` | week | `klacht` | 1 | 2 | Dien een klacht in bij de Raad |
| `w-tribunaal` | week | `tribunaal_stem` | 1 | 3 | Stem in een tribunaal |
| `w-verbond` | week | `verbond_gesloten` | 1 | 3 | Sluit een verbond |
| `w-premie` | week | `premie_geind` | 1 | 4 | Claim een premie |
| `w-missie` | week | `missie_voltooid` | 1 | 4 | Voltooi een stille missie |
| `w-seizoen` | week | `seizoen_daad` | 15 | 4 | Doe deze week vijftien daden tegen {dreiging} |

Hoe de pool groeit:
- **Groei:** de pool gaat van 16 naar 26 opdrachten, 10 voor de dag en 16 voor de week. Per dag blijven het er 3 en per week 2.
- **Volgorde:** de nieuwe regels komen achteraan. De 16 bestaande blijven in dezelfde volgorde staan.
- **Geen verschuiving:** `kiesOpdrachten` kiest met `h % rest.length`. Elke nieuwe regel, ook een regel achteraan, verandert die lengte, en dus ook de keuze van vandaag en van deze week. De voortgang staat per id in `opdrachten.json`, en die zou dan uit beeld raken. Daarom krijgt elke nieuwe regel `vanaf: OPDRACHTEN_NIEUW_VANAF`. De pool voor een sleutel bevat alleen regels zonder `vanaf` of met `vanaf <= sleutel`. Week- en dagsleutels zijn allebei `JJJJ-MM-DD`, dus een gewone stringvergelijking volstaat.
- **`{dreiging}`:** wordt de naam van de dreiging van het lopende seizoen, midden in de zin met een kleine letter (net als `{vijand}`). Loopt er geen seizoen, dan staat er "de dreiging van het seizoen".
- **`seizoen_daad`:** telt elke daad die in `telActie` schade doet aan het seizoen (`draagBijAanSeizoen` geeft iets terug).
- **Wie betaalt:** de beloningen van opdrachten en bingo betaalt de Raad, net als nu, via `pasScoreAanMetCheck`. Ze vallen buiten de plafonds van de regisseur.

### Bingovakjes

`BINGO_POOL` wordt elke maandag willekeurig geschud, dus achteraan toevoegen is veilig. De Raad weegt het bewijs, net als bij de andere vakjes.
- Deel A: `'Overleef een poging tot zelflof'`.
- Deel B, samen met de bui: `'Bedel om een kroketpunt tijdens een vrijgevige bui'`. Dit vakje kan pas als de bui bestaat; daarom komt het niet in deel A.

### Uitlokken

Een ingreep kan een veld `uitlokt` hebben: de opdrachtacties waarvoor hij de gelegenheid schept. `bouwRegieStand` levert `opdrachtActies` aan: de acties van de dagopdrachten van vandaag (de basiskeuze, niet de herkansingen per lid) en van de twee weekopdrachten. Staat een actie van `uitlokt` daarin, dan telt het gewicht van de ingreep keer `UITLOK_FACTOR = 3`.

### De ingrepen (deel B)

Alle tien zijn gewone ingrepen in de laag `ingreep`, met `maxPerDag: 1`. Ze komen in `REGIEBOEK` ná de bestaande ingrepen, zodat een geforceerde tik met `rng = 0` niet verschuift (zie `regie-geraamte.js`).

| id | soort | afkoel | voorwaarde | doelwit | punten / omvang | duur | uitlokt |
|---|---|---|---|---|---|---|---|
| `premie` | gril | 24 u | ma t/m do; `!premieDezeWeek`; er is een premiedoel | eerst een ontsnapte balling (effect `ontsnapt`), anders de nummer één van de week met score ≥ 1 | omvang geven 3 | tot de weekreset | `premie_geind` |
| `stille_missie` | geven | 48 u | `!missieLoopt`; minstens 1 actief lid | een willekeurig actief lid | omvang geven 3 | 24 u (de missie zelf) | `missie_voltooid` |
| `ketter_voordracht` | nemen, `schorsing: true` | 48 u | een lid met `ketterij` en zonder `geleKaartDezeWeek`; `!raad.pollLoopt` | dat lid | 0 | stemming van 15 min | `raad_stem` |
| `licht_tribunaal` | nemen | 72 u | `!zaakLoopt`; minstens 4 leden in de basis; een lid met `ketterij` of met `kaarten30 >= 2` | dat lid, ketterij gaat voor | omvang nemen 2 | stemming van 30 min | `tribunaal_stem` |
| `genade` | geven | 24 u | een lid met `berouw` | die balling | 0 | geen | geen |
| `zegendag` | geven | 72 u | minstens 3 leden in de basis | iedereen | omvang geven 3 | rest van de dag | `gezegend` |
| `verbondsdag` | geven | 72 u | `verbondenAan`; minstens 2 leden zonder verbond | iedereen | omvang geven 2 | rest van de dag | `verbond_gesloten` |
| `klachtenuur` | gril | 72 u | vóór 11:00; `!raad.pollLoopt` | iedereen | 0 | 60 min | `klacht`, `raad_stem` |
| `vrijgevige_bui` | geven | 72 u | minstens 2 leden vandaag actief | iedereen | omvang geven 3 | 60 min | geen |
| `seizoensdag` | gril | 72 u | `seizoen.actief` en de dreiging staat in `SEIZOENSDAGEN` | iedereen | 0 | rest van de dag | `seizoen_daad` |

Toelichting:
- **"Rest van de dag"** betekent tot 24:00 Amsterdamse tijd: `restVanDag(nu)` in minuten.
- **Genade** is de enige ingreep die een balling als doelwit heeft. Het is een gift. De regel "ballingen zijn nooit doelwit" blijft voor alle andere ingrepen gelden.
- **Berouw:** de balling diende een beroep in (`verbanning[id].beroepGeprobeerd`). De winkeltekst zegt nu al "Toon eerst berouw met `beroep`". Het geldt niet bij een rode kaart (`kaart === 'rood'`, een besluit van de Raad), en niet als de ban minder dan 30 minuten te gaan heeft. Het effect is hetzelfde als bij een geslaagd beroep: het record gaat weg en `bevrijdAlliantiePartnerMee(id, naam, false)` volgt.
- **Een balling die uitbreekt, wordt een premie waard.** Een geslaagde `uitbreken` zet een effect `ontsnapt` (24 uur, `data.doel`). De premie kiest dat lid dan eerst.
- **Seizoensdagen** tellen dubbel voor het seizoen, niet voor punten. Voor de dreiging van het lopende seizoen telt één actie die dag dubbele schade in `draagBijAanSeizoen`. `SEIZOENSDAGEN`:
  - `verkilling`: Vetdag, actie `offer`;
  - `zuurvet`: Zuiveringsdag, actie `eer_gegeven`;
  - `ketchupvloed`: Mosterddag, actie `duel`.

### Ketterij: een controleerbare aanleiding

De oude herkenning (airfryer, ketchup) staat uit en is geen logbare gebeurtenis. In plaats daarvan leest `bouwRegieStand` de lidberichten van vandaag uit Het Grote Archief (`entriesTussen({ soort: 'lid', van: begin van vandaag })`). Er komt geen nieuwe haak en geen nieuwe state.
- **Wat ketterij is:** een bericht met `airfryer`, `air fryer`, `hete lucht` of `magnetron`, of een bericht met zowel `ketchup` als `kroket`. Dit is `isKetterij(tekst)` in `lib/regie.js`, ongevoelig voor hoofdletters.
- **Wat de stand krijgt:** `leden[].ketterij` = de eerste 120 tekens van het nieuwste bericht dat ketterij is, of `null`.
- **Uitzondering:** in de week van De Airfryer-Kroket (`raid.vijand.key === 'airfryer_kroket'`) is het altijd `null`, want dan gaat elk aanvalsbericht over de airfryer.
- **Valse treffers** (ook "ik haat ketchup op een kroket") zijn geen probleem. De Raad stemt, en de Kroket God stemt niet mee.

### De gele kaart van de Kroket God

- Hij draagt open voor, niet anoniem: op het bord staat "Door: de Kroket God".
- **Hij stemt niet mee:** `godStem: 'onthouden'` weegt 0. Bij 0 tegen 0 volgt dus geen kaart, want bij twijfel geen straf.
- **Geen overrule** bij zijn eigen voordracht.
- **De stemming duurt 15 minuten**, niet 5: anders ziet niemand hem op tijd.
- **Nooit rood:** alleen een lid zonder gele kaart deze week kan doelwit zijn. Het ergste is dus een uur schorsing.
- **Plafond:** de ingreep heeft `schorsing: true`. Hij telt dus meteen als de schorsing van de dag, ook als de Raad hem afwijst. Te voorzichtig tellen is veilig.

### Het lichte tribunaal

Het lichte tribunaal staat helemaal los van het Tribunaal der Vergetelheid. Het schrijft nooit in `tribunaal.json` of `archief.json`, en het roept nooit `archiveerLid`, `vraagKickBevestiging` of een kick aan.
- **De zaak** staat in `regie.json` onder een nieuw veld `zaak`, niet in `effecten`. `ruimOp` ruimt verlopen effecten op, en zou een zaak die nog moet sluiten dus weggooien.
- **Stemmen:** drie knoppen, Boete, Schandtitel en Vrijspraak. Stemmen mogen leden die niet verbannen zijn, behalve het doelwit. Een stem mag je wijzigen. De stemming duurt 30 minuten.
- **De uitspraak:**
  - minder dan 2 stemmen is vrijspraak;
  - anders wint de meeste stemmen;
  - bij gelijkspel wint de mildste: vrijspraak, dan titel, dan boete.
- **Boete:** 2 punten naar de Schatkist via `neemNawerking`. De Zegen vangt de boete op.
- **Schandtitel:** 24 uur lang, als effect `schandtitel` met `{ doel, titel }`. Bij ketterij is de titel "Ketter van de Dag", bij twee kaarten "Vaste Klant van de Raad". De Kroket God spreekt het lid in een mention met die titel aan.
- **Sluiten** doet de minuutklok `regieKlok`, op basis van `zaak.sluitTs`, nooit met een `setTimeout`.

### Klachtenuur

Een uur lang wordt de eerste klacht die niet ontmaskerd wordt een gele-kaartvoordracht. De klager is de aanklager en blijft anoniem, zoals bij `gelekaart`.
- **Het onderzoek:** de reden krijgt één citaat van de beschuldigde uit het archief mee (`willekeurigCitaat({ sprekerIds: [doel] })`), als "uit het onderzoek".
- **Het Verhoor** (de quiz "wie zei dit?" van donderdag) doet hier niet mee. Dat is een spel met een vaste onthulling, geen onderzoek.
- **Hoogstens één voordracht per klachtenuur** (`data.gebruikt`). Loopt er al een stemming, dan blijft de klacht een tekst met een korte notitie.

### Dagen

- **Zegendag:** iedereen die niet verbannen is, mag die dag één keer `zegen [naam]`, ook wie geen profeet is. Dat is +1 via `betaalNawerking`. De profeet houdt zijn eigen weekzegen ernaast, die loopt zoals nu. Zichzelf zegenen of een balling zegenen mag niet. Is er geen ruimte, dan volgt een melding, en de zegen telt niet als gebruikt.
- **Verbondsdag:** wie die dag een verbond sluit (een nieuw paar: beide leden; bij aansluiten: wie aansloot), komt in `data.gesloten`. Krijgt zo'n lid die dag een Verbondszegen, dan krijgt het hetzelfde bedrag nog een keer, via `betaalNawerking`.
- **De Verbondszegen** wordt alleen nog een regel in de draad (`naspel`). Zonder naspel komt er geen los bericht meer, alleen de bonus.
- **Vrijgevige bui:** wie in een mention bedelt, krijgt één keer per bui +1 in plaats van de kans op −1.

### Wat verdwijnt en wat blijft

- **Weg:** de cron `0 11 * * 3` (premiejacht) en zijn label in `CRON_LABELS`.
- **Zelflof:** geen nieuwe ingreep. De bestaande publieke tirade is al de berisping. Let op: de zelflofcheck zit niet in `voerEer`, maar in het `eer`-commando (rond regel 7065) en in de eer via een mention (rond regel 9085). Beide blijven onaangeroerd.
- **Knoppen:** er komen alleen de stemknoppen van het lichte tribunaal bij. `klacht`, `begenade`, `zegen`, `alliantie`, `gelekaart` en `tribunaal` staan al in het Home-menu via het commandoregister.
- **Onaangeroerd blijven:**
  - het Tribunaal der Vergetelheid (de klok van 10:40 en de kick);
  - de wroklaag (Zwarte Korst, Dubbele Korst, vetpapier, Blinde Handdruk);
  - de mechaniek van verbanning en verbonden. Alleen de zichtbaarheid verandert, plus de bonus van de verbondsdag.

### Wie wat betaalt (alleen de regisseur, via de plafonds)

| bron | bedrag | via | id in het log |
|---|---|---|---|
| premie geïnd | 3 | `betaalNawerking` | `premie` |
| stille missie van de regisseur | 3 per deelnemer | `betaalNawerking` | `stille_missie` |
| zegen op een zegendag | 1 | `betaalNawerking` | `zegendag` |
| verbondsdag | zelfde als de zegen (1-3) | `betaalNawerking` | `verbondsdag` |
| vrijgevige bui | 1 per lid per bui | `betaalNawerking` | `vrijgevige_bui` |
| boete van het lichte tribunaal | −2 | `neemNawerking` (Zegen ketst af) | `licht_tribunaal` |

Een missie die de beheerder met de hand start, betaalt zoals nu, via `pasScoreAanMetCheck`.

## Global Constraints

- **Plafonds per dag**, alle lagen samen, ongewijzigd:
  - hoogstens 15 punten gegeven;
  - hoogstens 10 genomen, en hoogstens 5 per lid;
  - hoogstens 1 schorsing;
  - nooit onder nul.
- **Uitbetalen achteraf (P16):** op het moment van uitbetalen begrensd tegen `regie.ruimte(regieStaat(), nu)`, eerst uit de Schatkist, en geboekt met `boekNawerking`. `neemNawerking({ nu, id, doel, punten })` is het spiegelbeeld van `betaalNawerking`: eerst de Zegen-check, dan `min(punten, saldo, ruimte.nemen, ruimte.nemenVan(doel))`, dan `pasScoreAan(−n)`, `stort` en `boekNawerking(−n)`. Heeft spoor 2 (taak 8) al zo'n helper, gebruik die dan.
- **Waarden:**
  - `UITLOK_FACTOR = 3`;
  - `OPDRACHTEN_NIEUW_VANAF = '2026-11-23'`. Dat moet de maandag op of na de deploy van deel A zijn; schuif het op als de deploy later valt;
  - premie 3, hoogstens 1 per week;
  - stemming over de voordracht van de Kroket God 15 minuten;
  - licht tribunaal 30 minuten, minstens 2 stemmen, boete 2, titel 24 uur;
  - klachtenuur en vrijgevige bui 60 minuten.
- **Restartveilig:** alles staat in `regie.json` (`zaak`, en de effecten `zegendag`, `verbondsdag`, `seizoensdag`, `klachtenuur`, `vrijgevig`, `ontsnapt` en `schandtitel`), `premie.json` (`door: 'regisseur'`), `missie.json` (`door`) of `gelekaartpoll.json` (`door`, `godStem: 'onthouden'`). Er komt geen nieuw bestand bij, en er komt geen `setTimeout`.
- **Nooit een kick door de regisseur.** Hij leest of schrijft `tribunaal.json` en `archief.json` niet.
- **`OPDRACHTEN`:** nooit een bestaande regel weghalen of verplaatsen.
- **Dagsleutels:** `dagSleutel()` en `getMondayOfWeek()` geven `JJJJ-MM-DD`. De raid en de duels gebruiken `nl-NL`. Gebruik per bestand het formaat dat er al staat.
- **Rooktests:** wat een rooktest nodig heeft, komt in het `KROKET_ROOKTEST`-export van `index.js`. De bestaande rooktests van spoor 2 blijven groen; let vooral op `regie-macht.js` (de overrule) en `regie-geraamte.js`.
- **Werkwijze:**
  - commit per task;
  - deploy deel A na task A2 en deel B na task B7, elk met een md5-controle;
  - de repo is openbaar: scan op geheimen voor elke push;
  - de eigenaar draait `bash deploy.sh` zelf, want auto-mode blokkeert deploys.

## Review Focus

1. **De opdrachten van deze week verschuiven.** Elke nieuwe regel in `OPDRACHTEN` verandert `h % rest.length`. Verwacht: voor elke sleutel vóór `OPDRACHTEN_NIEUW_VANAF` precies dezelfde ids als vóór de wijziging. Test "oude keuzes blijven" in task A1.
2. **De Kroket God stemt over zijn eigen voordracht.** Een lege `godStem` wordt bij het sluiten opnieuw geworpen (65% "terecht", en die stem weegt dubbel). Dan gaat een kaart door zonder één stem van een lid. Verwacht: bij 0-0 geen kaart en geen overrule, en nooit een voordracht tegen wie deze week al geel heeft. Tests "God stemt niet mee" en "nooit rood" in task B3.
3. **Het lichte tribunaal verdwijnt bij een herstart, of kickt.** Verwacht: na een tik met `ruimOp` staat de zaak er nog. De klok sluit hem één keer. `tribunaal.json`, `archief.json` en `members.json` blijven ongemoeid. Tests "herstart" en "nooit een kick" in task B4.
4. **Een uitbetaling boven het plafond.** Premie, missie, zegen, verbondsdag en bui betalen later uit. Verwacht: begrensd op de ruimte van dat moment; bij 0 ruimte een melding en geen punt. Test "premie boven het plafond" in task B2, en "zegendag op het plafond" in task B5.
5. **Een dode dagopdracht.** "Laat u zegenen" kan op de meeste dagen niet. Verwacht: `opdrachtHaalbaar` geeft `false` zodra de profeet zijn zegen kwijt is en er geen zegendag is, zodat de bestaande herkansing hem vervangt. Test "dode zegenopdracht" in task A1.

---

## Deel A: opdrachten en bingo

### Task A1: De pool groeit zonder te verschuiven

**Files:**
- Modify `index.js`:
  - `OPDRACHTEN`: tien regels achteraan, uit de tabel bij Beslissingen. Pas het commentaar "Houdt de weekpool op 8" aan.
  - Nieuw `OPDRACHTEN_NIEUW_VANAF`, en een nieuwe `opdrachtPool(soort, sleutel)`. `kiesOpdrachten` en de herkansingspool in `dagOpdrachtenVoor` gebruiken hem allebei.
  - `opdrachtTekst`: lost `{dreiging}` op.
  - `opdrachtHaalbaar`: twee nieuwe gevallen.
  - Het rooktest-export krijgt `opdrachtPool`, `kiesOpdrachten`, `opdrachtHaalbaar` en `opdrachtTekst`.
- Create `scripts/rooktest/opdrachten-pool.js`.

**Interfaces (Produces):**
- `opdrachtPool(soort, sleutel) -> opdracht[]`: `OPDRACHTEN` gefilterd op soort, en op `!o.vanaf || o.vanaf <= sleutel`.
- `kiesOpdrachten(soort, sleutel, aantal)`: dezelfde signatuur en hetzelfde algoritme, met de pool uit `opdrachtPool`.
- `opdrachtHaalbaar(userId, o, resterend)`, nieuwe gevallen:
  - `gezegend`: `true` als `profeet.json` deze week een profeet heeft die niet `userId` is en `zegenGebruikt` niet staat, of als het effect `zegendag` loopt (`regie.effectActief(regieStaat(), 'zegendag', Date.now())`);
  - `seizoen_daad`: `true` als `seizoen.json` de status `actief` heeft.

- [ ] Leg vóór elke wijziging de huidige keuzes vast. Zet daarvoor tijdelijk `kiesOpdrachten` in het export, en noteer de ids voor de week `2026-11-16` en voor de dagen `2026-11-17` t/m `2026-11-22`. Die worden de vaste verwachting in de rooktest.
- [ ] Rooktest `opdrachten-pool.js`:
  - **Oude keuzes blijven:** voor elke vastgelegde sleutel geeft `kiesOpdrachten` precies de genoteerde ids.
  - **Volgorde:** de eerste 16 ids van `OPDRACHTEN` zijn de oude lijst, in de oude volgorde (vast in de test).
  - **Nieuwe pool vanaf maandag:** `opdrachtPool('dag', '2026-11-23').length === 10`, `opdrachtPool('week', '2026-11-23').length === 16` en `opdrachtPool('week', '2026-11-16').length === 8`.
  - **{dreiging}:** met een actief seizoen "De Grote Verkilling" bevat de tekst van `d-seizoen` "de Grote Verkilling" en geen `{`. Zonder seizoen staat er "de dreiging van het seizoen".
  - **Dode zegenopdracht:**
    - een profeet UA met een ongebruikte zegen geeft voor UB `true` en voor UA zelf `false`;
    - na `zegenGebruikt: true` geeft het voor UB `false`;
    - met een effect `zegendag` in `regie.json` weer `true`.
- [ ] Implementeer. Draai `npm test`, deze rooktest en alle bestaande rooktests.
- [ ] Commit.

### Task A2: De haken in de spellogica, en deploy van deel A

**Files:**
- Modify `index.js`, met één `await telActie(client, wie, actie)` per plek:

  | actie | plek | wie telt |
  |---|---|---|
  | `raad_stem` | `sluitGeleKaartPoll`, na de `saveGeleKaartPoll(poll)` die de stemming sluit | elke stemmer in `stemmen.terecht` en `stemmen.onterecht` (al gefilterd: leden, geen ballingen, dubbelstemmers eruit) |
  | `begenade` | `begenade`-commando, na een geslaagde genade | de gever |
  | `klacht` | `klacht`-commando, in beide takken (met en zonder ontmaskering) | de klager |
  | `gezegend` | `zegen`-commando, de profetenroute na de puntenboeking | de ontvanger |
  | `tribunaal_stem` | `stemTribunaal`, alleen als `oud` leeg is (de eerste stem) | de stemmer |
  | `verbond_gesloten` | `alliantie [naam]` (nieuw paar) en `verbond_accepteer` (aansluiten) | de aanvrager: `command.user_id` of `v.vanId` |
  | `premie_geind` | het premieblok in `voerDuel` | de winnaar |
  | `missie_voltooid` | `vollooiMissie` | elke deelnemer |
  | `seizoen_daad` | `telActie` zelf: als `draagBijAanSeizoen` iets teruggaf, tellen opdrachten met actie `seizoen_daad` ook mee (met `aantal`), en `bumpTeller(userId, 'seizoen_daad', aantal)` | het lid |

- `BINGO_POOL`: `'Overleef een poging tot zelflof'` achteraan.
- `scripts/rooktest/harnas.js`: `schakel.reacties` (een lijst `{ name, users }`). `reactions.get` geeft `{ ok: true, message: { reactions: schakel.reacties || [] } }` terug.
- Rooktest-export: `stemTribunaal` en `vollooiMissie`.
- Create `scripts/rooktest/opdrachten-haken.js`.

**Interfaces (Consumes):** `telActie(client, userId, actie, aantal, naspel)` blijft gelijk. `tellers.json` telt elke actie, ook als er geen opdracht op staat, en daarop toetst de rooktest.

- [ ] Rooktest `opdrachten-haken.js`. Elke test kijkt naar `tellers.json[lid][actie]`:
  - **Raad:** een gesloten poll met `schakel.reacties` = UB en UC geel, UD op beide. Na `sluitGeleKaartPoll` is UB 1, UC 1 en UD 0. Een tweede `sluitGeleKaartPoll` telt niet nog eens.
  - **Begenade:** UB verbannen, UA heeft 5 punten. Na `begenade Bravo` is UA 1.
  - **Klacht:** `klacht Bravo te veel mayonaise` geeft UA 1. Zet `Math.random` op 0.01 en daarna op 0.5, zodat beide takken één keer draaien.
  - **Zegen:** profeet UA. Na `zegen Bravo` is UB 1.
  - **Tribunaal:** een `tribunaal.json` in de fase `stemming`. Twee keer `stemTribunaal(UA)` geeft UA 1, niet 2.
  - **Verbond:** na `alliantie Charlie` is UA 1 en UC 0.
  - **Premie:** een premie op UB, en UA wint een duel met het `duelMet`-patroon uit `regie-grillen.js`. Dan is UA 1.
  - **Missie:** `vollooiMissie` met de deelnemers UA en UB geeft beide 1.
  - **Seizoen:** met een actief seizoen geeft een offer van UA `seizoen_daad` 1. Met de status `verloren` blijft het 0.
- [ ] Implementeer. Draai `npm test` en alle rooktests.
- [ ] Commit.
- [ ] **Deploy deel A:**
  - controleer dat `OPDRACHTEN_NIEUW_VANAF` de maandag op of na vandaag is;
  - scan op geheimen, voeg samen met de live branch en push;
  - deploy, met de md5-controle;
  - lees de log: wakker, geen fouten;
  - werk het geheugen bij.

## Deel B: de ingrepen van de regisseur

### Task B1: Het regieboek voor gerechtigheid, dagen en uitlokken (puur)

**Files:** Modify `lib/regie.js` en `lib/regie.test.js`.

**Interfaces (Produces):**
- **`REGIEBOEK`:** tien nieuwe regels uit de tabel bij Beslissingen, ná de bestaande ingrepen. De ids zijn `premie`, `stille_missie`, `ketter_voordracht`, `licht_tribunaal`, `genade`, `zegendag`, `verbondsdag`, `klachtenuur`, `vrijgevige_bui` en `seizoensdag`. `ketter_voordracht` heeft `schorsing: true`.
- **Uitlokken:** een veld `uitlokt: string[]` en `UITLOK_FACTOR = 3`. In `kiesIngreep` wordt het gewicht `i.gewicht × (na een straf 2) × (uitgelokt 3)`. Uitgelokt betekent: een actie van `i.uitlokt` staat in `stand.opdrachtActies`.
- **`isKetterij(tekst) -> bool`.**
- **`SEIZOENSDAGEN`:** `{ verkilling: { naam: 'Vetdag', actie: 'offer', uitleg }, zuurvet: { naam: 'Zuiveringsdag', actie: 'eer_gegeven', uitleg }, ketchupvloed: { naam: 'Mosterddag', actie: 'duel', uitleg } }`.
- **`restVanDag(nu) -> minuten`** tot 24:00 Amsterdamse tijd.
- **`nieuweStaat()`** krijgt `zaak: null`. `ruimOp` laat `zaak` staan.
- **Kopcommentaar:** de nieuwe velden van de stand, die de B-taken in `bouwRegieStand` vullen:
  - `leden[]`: `ketterij`, `kaarten30`, `berouw`, `ontsnapt` en `inVerbond`;
  - `raad: { pollLoopt }`;
  - `zaakLoopt`, `premieDezeWeek`, `missieLoopt` en `verbondenAan`;
  - `seizoen: { actief, dreiging }`;
  - `opdrachtActies`.

  Ook de vorm van `zaak`: `{ id, doel, grond: 'ketterij'|'kaarten', citaat, titel, stemmen: { userId: 'boete'|'titel'|'vrij' }, sluitTs, kanaal }`.

- [ ] Tests (`lib/regie.test.js`), met de bestaande helpers `stand`, `metLid`, `alleen` en `NU`:
  - **Per nieuwe ingreep:** de voorwaarde klopt in het goede geval en faalt zonder aanleiding. Elk is een eigen `test(...)` met de id in de naam.
  - **Premie:** een ontsnapte balling gaat voor de koploper. Is de koploper vandaag al doelwit en er is geen ontsnapte, dan geen premie. Op vrijdag geen premie. Met `premieDezeWeek` geen premie.
  - **Ketter_voordracht:** nooit tegen een lid met `geleKaartDezeWeek`. Niet bij `raad.pollLoopt`. Niet als `ruimte().schorsing === 0`. Boeken geeft een logregel met `schorsing: true`.
  - **Licht_tribunaal:** niet bij `zaakLoopt`, en niet met 3 leden. `kaarten30 >= 2` is genoeg aanleiding. Ketterij gaat voor kaarten. Niet tegen wie gisteren gestraft werd.
  - **Genade:** het doelwit is een verbannen lid met `berouw`. Een verbannen lid zonder berouw is nooit doelwit van welke ingreep dan ook.
  - **Uitlokken:** twee kandidaten met gewicht 1, en `opdrachtActies` bevat de actie van de tweede. Met `rng` 0,3 wint de tweede (3 van 4). Zonder `opdrachtActies` wint met dezelfde `rng` de eerste.
  - **isKetterij:**
    - `true` voor 'ketchup op mijn kroket', 'mijn Air Fryer is kapot', 'heteluchtoven' en 'magnetronkroket';
    - `false` voor 'ketchup bij de friet' en 'een goudbruine kroket'.
  - **restVanDag:** om 10:00 is het 840, om 23:30 is het 30, ook over de wintertijdgrens.
  - **Staat:** `ruimOp` laat `zaak` staan.
  - **SEIZOENSDAGEN:** er is een regel voor `verkilling`, `zuurvet` en `ketchupvloed`.
- [ ] Draai de tests: ze falen.
- [ ] Implementeer.
- [ ] Groen, ook `regie-geraamte.js`.
- [ ] Commit.

### Task B2: De premie en de stille missie via de regisseur

**Files:** Modify `index.js`:
- **`bouwRegieStand`:**
  - `premieDezeWeek`: in `premie.json` is `weekStart` deze week;
  - `missieLoopt`: in `missie.json` is `status` gelijk aan `'actief'`;
  - `leden[].ontsnapt`: er loopt een effect `ontsnapt` met `data.doel === id`;
  - `opdrachtActies`.
- **`UITVOERDERS.premie`:** schrijft `premie.json` als `{ doelwitId, bonus: 3, weekStart, geind: false, door: 'regisseur' }` en roept `logGebeurtenis('premie', ...)` aan. De feiten noemen het doelwit, de 3 punten en "wie hem deze week in een duel verslaat".
- **`startStilleMissie(client, channelId, doelwitId, { door = 'beheerder' })`:** dit is de body van `missie starten` (doelwit plus vrije bondgenoten, `genereerMissie`, `saveMissie`, ephemeral per deelnemer) zonder de publieke aankondiging. Het beheerderscommando roept hem aan met een willekeurig doelwit en kondigt aan zoals nu.
- **`UITVOERDERS.stille_missie`:** roept `startStilleMissie(..., { door: 'regisseur' })` aan, en geeft `tekst` terug: een geheimzinnige aankondiging via `kroketResponseMetVangnet`, die het doelwit niet noemt.
- **`vollooiMissie`:** bij `missie.door === 'regisseur'` betaalt hij per deelnemer via `betaalNawerking({ id: 'stille_missie', punten: 3 })`. De prompt noemt het echt uitbetaalde bedrag.
- **Het premieblok in `voerDuel`:** uitbetalen via `betaalNawerking({ id: 'premie', doel: winId, punten: premie.bonus || 3 })`. `geind` wordt altijd `true`. Is `n === 0`, dan zegt `premieBlok` dat de Schatkist leeg is.
- **`uitbreken`, geslaagd:** zet een effect `ontsnapt` voor 24 uur met `data.doel` en een eigen id per lid.
- **Weg:** de cron `0 11 * * 3` met zijn label in `CRON_LABELS`.
- **Rooktest-export:** `startStilleMissie`.
- Create `scripts/rooktest/regie-premie-missie.js`.

- [ ] Rooktest `regie-premie-missie.js`:
  - **Premie op de ontsnapte:** UA staat bovenaan en UC heeft een effect `ontsnapt`. Een geforceerde tik met `beschikbaar: ['premie']` zet `premie.json` op doelwit UC, met `door: 'regisseur'` en de week van nu.
  - **Premie geïnd:** de Schatkist staat op 2 en UA wint van UC. UA krijgt de inzet plus 3. De Schatkist gaat naar 0, en het log krijgt een nawerking `premie` van +3. `premie.json` heeft `geind: true`.
  - **Premie boven het plafond:** het log heeft vandaag al +15. UA wint van UC: `geind: true`, geen premiepunten, en het duelbericht noemt de lege Schatkist.
  - **Cron weg:** het dashboard en `CRON_LABELS` kennen `0 11 * * 3` niet meer (zelfde aanpak als `regie-toespraken.js`).
  - **Stille missie zonder beheerder:** een geforceerde tik met `['stille_missie']` geeft in `missie.json` de status `actief` met `door: 'regisseur'`. Het kanaalbericht bevat de bijnaam van het doelwit niet. Er is een ephemeral naar het doelwit.
  - **Missie via het plafond:** `vollooiMissie` geeft per deelnemer +3 als nawerking `stille_missie`.
  - **Uitlokken:** `bouwRegieStand(nu).opdrachtActies` bevat de acties van `kiesOpdrachten('week', getMondayOfWeek())`.
- [ ] Implementeer.
- [ ] Groen, ook `opdrachten-haken.js`.
- [ ] Commit.

### Task B3: Ketterij, de gele kaart van de Kroket God en het klachtenuur

**Files:**
- Modify `index.js`:
  - **`bouwRegieStand`:** `leden[].ketterij` (archief van vandaag plus `regie.isKetterij`; `null` in de week van `airfryer_kroket`) en `raad.pollLoopt` (in `gelekaartpoll.json` is `actief` waar).
  - **`startGeleKaartPoll(client, doelwitId, aanklagerId, reden, channelId, { door, minuten } = {})`:** bij `door === 'regisseur'` geldt `aanklagerId: null`, `poll.door = 'regisseur'`, `godStem: 'onthouden'` en `sluitTs` = nu + `minuten` (15).
  - **`bouwGeleKaartPollBlocks`:** bij `door === 'regisseur'` staat er "Door: de Kroket God" in plaats van de anonieme volgeling, en "De Kroket God stemt niet over zijn eigen voordracht" in plaats van zijn stem.
  - **`sluitGeleKaartPoll`:** `godStem === 'onthouden'` weegt 0 en wordt nooit opnieuw geworpen. Er is geen overrule als `poll.door === 'regisseur'`. De prompt zegt niet dat zijn stem dubbel woog.
  - **`UITVOERDERS.ketter_voordracht`:** start de poll met de reden `ketterij: "<citaat>"`. Bij `ok` geeft hij `{ tekst: null }` terug, want het bord is de aankondiging. Bij `!ok` gooit hij, zodat er niets wordt geboekt.
  - **`UITVOERDERS.klachtenuur`:** zet het effect `klachtenuur` voor 60 minuten met `{ gebruikt: false }`. De feiten leggen uit dat een klacht dit uur een stemming oplevert.
  - **Het `klacht`-commando:** in de tak zonder ontmaskering, als `klachtenuur` loopt, `!data.gebruikt` en er geen poll loopt:
    - eerst `gebruikt` zetten;
    - dan `startGeleKaartPoll(client, doelwitId, command.user_id, reden + onderzoekscitaat, channel)`.

    Loopt er al een poll, dan komt er een korte notitie bij de klacht.
  - **Rooktest-export:** `startGeleKaartPoll`.
- Modify `scripts/rooktest/harnas.js`: `KROKET_ARCHIEF_PAD` wijst naar `grootarchief.ndjson` in de tijdelijke statemap. Nu schrijft een rooktest in het archief van de repo.
- Create `scripts/rooktest/regie-raad.js`. Het archief vul je met `require('../../lib/archief.js').voegToeAanArchief(...)`; dat is dezelfde module-instantie als die van `index.js`.

- [ ] Rooktest `regie-raad.js`:
  - **Ketterij herkend:** UB schrijft vandaag "ketchup op mijn kroket, heerlijk". `bouwRegieStand().leden` geeft UB een `ketterij` met "ketchup". Met de weekvijand `airfryer_kroket` is het `null`.
  - **Voordracht door de Kroket God:** een geforceerde tik met `['ketter_voordracht']` geeft een actieve `gelekaartpoll.json` met `door: 'regisseur'`, `godStem: 'onthouden'` en `sluitTs` op ongeveer nu + 15 minuten. Het bord bevat "de Kroket God" en niet "anonieme".
  - **God stemt niet mee:** geen reacties, `sluitTs` verstreken en `sluitGeleKaartPoll({ rng: () => 0 })`. De uitkomst is `onterecht`: geen ban voor UB, geen kaart, en geen `uitslag.regisseur`.
  - **De Raad beslist:** twee gele reacties geven een toegekende gele kaart: UB is een uur verbannen, met kleur `geel`.
  - **Nooit rood:** UB heeft `geleKaartDezeWeek`, dus `kiesIngreep` met `['ketter_voordracht']` geeft `null`.
  - **Klachtenuur:** met het effect actief en `Math.random` op 0.5 maakt `klacht Bravo eet ketchup` van UA een actieve poll op UB, met `aanklagerId` UA en zonder `door`. Een tweede klacht in hetzelfde uur geeft geen tweede poll.
  - **Zonder klachtenuur:** een klacht geeft alleen tekst, en `gelekaartpoll.json` blijft ongewijzigd.
  - **Overrule blijft werken:** `regie-macht.js` is groen.
- [ ] Implementeer.
- [ ] Groen.
- [ ] Commit.

### Task B4: Het lichte tribunaal

**Files:** Modify `index.js`:
- **`bouwRegieStand`:**
  - `leden[].kaarten30`: het aantal kaarten in `geleKaarten.json` met `ts >= nu − 30 dagen`, geel en rood;
  - `zaakLoopt`: `regieStaat().zaak` bestaat.
- **`UITVOERDERS.licht_tribunaal`:** zet `zaak` in `regie.json`, met `sluitTs` = nu + 30 minuten. De titel is "Ketter van de Dag" of "Vaste Klant van de Raad". Hij geeft `tekst` terug (doelwit, grond en citaat, en "geen kick, alleen een boete of een titel") plus drie knoppen: `regie_zaak_boete`, `regie_zaak_titel` en `regie_zaak_vrij`, met als waarde `zaak.id`.
- **`app.action(/^regie_zaak_(boete|titel|vrij)$/)`** roept `stemZaak` aan en antwoordt ephemeral.
- **`stemZaak(client, userId, zaakId, keuze) -> { ok, tekst }`:**
  - weigert een niet-lid, een balling, het doelwit en een gesloten of andere zaak;
  - een stem mag je wijzigen;
  - bij de eerste stem volgt `telActie(client, userId, 'tribunaal_stem')`.
- **`sluitZaak(client, nu = Date.now()) -> uitspraak|null`:**
  - doet niets vóór `sluitTs` of zonder zaak;
  - telt de stemmen volgens de regels bij Beslissingen;
  - zet eerst `zaak: null` (en is daarmee idempotent), en voert dan uit:
    - boete: `neemNawerking({ id: 'licht_tribunaal', doel, punten: 2 })`;
    - titel: het effect `schandtitel` voor 24 uur met `{ doel, titel }`, met een eigen id per lid;
  - kondigt aan via `kroketResponseMetVangnet`, met een vangnetzin per uitspraak, en roept `logAudit('regie', ...)` aan.
- **`regieKlok`:** roept elke minuut eerst `sluitZaak(app.client)` aan. Bestaat `regieKlok` nog niet, plan hem dan hier met `planCron('* * * * *', regieKlok)`.
- **`neemNawerking`** naast `betaalNawerking`, zie Global Constraints.
- **De mention-prompt:** loopt er een `schandtitel` voor de spreker, dan komt er een regel bij: spreek hem vandaag spottend met die titel aan.
- **Rooktest-export:** `stemZaak` en `sluitZaak`.
- Create `scripts/rooktest/regie-tribunaal.js`.

- [ ] Rooktest `regie-tribunaal.js`:
  - **Start:** UB heeft ketterij. Een geforceerde tik met `['licht_tribunaal']` zet in `regie.json` een `zaak` op UB met `sluitTs` op ongeveer nu + 30 minuten. Het bericht heeft drie knoppen.
  - **Stemmen:**
    - UA kiest boete, UC boete en UD titel;
    - UB (het doelwit) wordt geweigerd, net als een verbannen UE;
    - UA wijzigt zijn stem in titel en weer terug, en heeft daarna in `tellers.json` `tribunaal_stem` 1.
  - **Herstart:** schrijf `regie.json` opnieuw met de zaak, met `sluitTs` in het verleden. Na `regieTik` (dat `ruimOp` draait) staat `zaak` er nog. `sluitZaak` geeft een boete: UB −2, de Schatkist +2 en `zaak === null`. Een tweede `sluitZaak` geeft `null` en verandert niets.
  - **Nooit een kick:** `tribunaal.json` en `archief.json` zijn ongewijzigd of bestaan niet. UB staat nog in `members.json`. Geen post bevat de knop `tribunaal_kick`.
  - **Titel:** twee stemmen voor titel geven het effect `schandtitel` voor UB met 24 uur looptijd en de juiste titel.
  - **Te weinig stemmen:** één stem geeft vrijspraak: geen punten en geen effect.
  - **Gelijkspel:** één boete en één titel geven de titel.
  - **Zegen:** UB heeft een Zegen. De boete neemt 0 en de aankondiging spot.
- [ ] Implementeer.
- [ ] Groen.
- [ ] Commit.

### Task B5: Zegendag, verbondsdag en seizoensdag, en de Verbondszegen in de draad

**Files:** Modify `index.js`:
- **`bouwRegieStand`:**
  - `verbondenAan`: `alliantiesActief()`;
  - `leden[].inVerbond`: `getBondgenoten(id).length > 0`;
  - `seizoen`: `{ actief: status === 'actief', dreiging: dreiging.key }`.
- **`UITVOERDERS.zegendag`, `verbondsdag` en `seizoensdag`:** een effect met `restVanDag(nu)` minuten.
  - zegendag: data `{ gezegend: [] }`;
  - verbondsdag: data `{ gesloten: [] }`;
  - seizoensdag: data `{ actie, naam }` uit `SEIZOENSDAGEN`.
- **Een kleine helper `pasEffectAan(id, f)`** om `data` van een lopend effect bij te werken, naar het voorbeeld van `verbruikRegieKnop`.
- **Het `zegen`-commando:**
  - is er een profeet met een ongebruikte zegen, dan loopt alles zoals nu;
  - anders, als `zegendag` loopt en de gever nog niet in `gezegend` staat: `betaalNawerking({ id: 'zegendag', doel, punten: 1 })`, de gever erbij, een templated regel in het kanaal en `telActie(doel, 'gezegend')`;
  - de weigertekst noemt de zegendag.
- **Allianties (nieuw paar en `verbond_accepteer`):** tijdens `verbondsdag` komen de leden in `data.gesloten`.
- **`kenAlliantiePuntenBonus`:**
  - na een geboekte bonus die niet verbrandde: staat de partner in `gesloten` op een lopende verbondsdag, dan volgt `betaalNawerking({ id: 'verbondsdag', doel: partnerId, punten: bonus })`, en de naspelregel noemt "×2";
  - zonder naspel komt er geen los bericht meer: haal de losse post en `uitgesteldeZegens.push` weg.
- **`draagBijAanSeizoen`:** loopt `seizoensdag` met `data.actie === actie`, dan telt het gewicht dubbel.
- **Rooktest-export:** `kenAlliantiePuntenBonus` en `draagBijAanSeizoen`.
- Create `scripts/rooktest/regie-dagen.js`.

- [ ] Rooktest `regie-dagen.js`:
  - **Zegendag:**
    - UA is geen profeet en zegent UB. UB krijgt +1, het log krijgt een nawerking `zegendag` van +1, en `tellers` geeft UB `gezegend` 1;
    - een tweede zegen van UA wordt geweigerd, net als een zegen van UA voor zichzelf;
    - de profeet met een ongebruikte weekzegen zegent nog zoals nu.
  - **Zegendag op het plafond:** het log heeft vandaag al +15. De zegen geeft geen punt, wel een melding, en UA staat niet in `gezegend`.
  - **Verbondsdag:**
    - `alliantie Charlie` van UA zet UA en UC in `gesloten`;
    - `kenAlliantiePuntenBonus(UA)` met `Math.random` op 0 geeft UC de bonus en dezelfde extra, met een nawerking `verbondsdag`.
  - **Verbondszegen in de draad:** zonder naspel komt er geen nieuwe post in `h.posts`, maar de partner krijgt de punten wel. Met een naspel komt er één regel.
  - **Seizoensdag:**
    - de Verkilling loopt en het effect `seizoensdag` heeft actie `offer`. `draagBijAanSeizoen('UA', 'offer')` haalt 2 HP af, en `'duel'` 1;
    - zonder actief seizoen kiest de tik `seizoensdag` niet.
- [ ] Implementeer.
- [ ] Groen, ook `opdrachten-haken.js`.
- [ ] Commit.

### Task B6: Genade bij berouw en de vrijgevige bui

**Files:** Modify `index.js`:
- **`bouwRegieStand`:** `leden[].berouw`. Dat is waar als het lid verbannen is, `beroepGeprobeerd` staat, de kaart niet rood is en `tot − nu` minstens 30 minuten is.
- **`UITVOERDERS.genade`:**
  - controleert opnieuw of het lid verbannen is en berouw toont;
  - haalt de verbanning weg en roept `bevrijdAlliantiePartnerMee(doel, naam, false)` en `logGebeurtenis('genade', ...)` aan;
  - is het lid al vrij, dan geeft hij `{ tekst: null }` terug.
- **`UITVOERDERS.vrijgevige_bui`:** het effect `vrijgevig` voor 60 minuten met `{ begiftigd: [] }`.
- **`bedelUitkomst(userId, nu) -> { soort: 'gift'|'straf'|'niets', punten }`:** dit haalt de beslissing uit de bedeltak van de mention-handler.
  - tijdens de bui geeft het één gift per lid via `betaalNawerking({ id: 'vrijgevige_bui', punten: 1 })`, met het lid in `begiftigd`; is er geen ruimte, dan `niets`;
  - buiten de bui gelden de bestaande regels: de Zegen beschermt, en anders is er 30% kans op −1.

  De handler post de tekst die bij de uitkomst hoort.
- **`BINGO_POOL`:** `'Bedel om een kroketpunt tijdens een vrijgevige bui'` achteraan.
- **Rooktest-export:** `bedelUitkomst`.
- Create `scripts/rooktest/regie-genade.js`.

- [ ] Rooktest `regie-genade.js`:
  - **Genade:**
    - UB is twee uur verbannen met `beroepGeprobeerd`. Een geforceerde tik met `['genade']` laat UB vrij;
    - is UB in een verbond met UC en is UC ook verbannen, dan is UC ook vrij.
  - **Geen genade:** de tik met `['genade']` geeft `null` bij een rode kaart, bij een ban zonder beroep en bij een ban die nog 20 minuten loopt.
  - **Vrijgevige bui:**
    - met het effect actief geeft `bedelUitkomst(UA)` een gift van +1; een tweede keer geeft `niets`, ook met `Math.random` op 0;
    - zonder bui en met `Math.random` op 0 volgt een straf van −1;
    - een Zegen-houder krijgt buiten de bui nooit straf.
  - **Bui op het plafond:** het log heeft vandaag al +15. De uitkomst is `niets`, en UA staat niet in `begiftigd`.
- [ ] Implementeer.
- [ ] Groen.
- [ ] Commit.

### Task B7: Eindcontrole en deploy van deel B

- [ ] Draai `npm test` en alle rooktests in `scripts/rooktest/`.
- [ ] Breid `scripts/rooktest/regie-week.js` uit (de gesimuleerde werkweek van spoor 2): een tik per 20 minuten, met alle nieuwe uitvoerders en een vaste `rng`. Die moet aantonen:
  - per dag nooit meer dan 15 gegeven, 10 genomen en 1 schorsing, ook met de nawerkingen erbij;
  - hoogstens één premie per week;
  - geen ingreep tegen een balling, behalve `genade`;
  - geen schrijfactie op `tribunaal.json` of `archief.json`;
  - een telling per nieuwe ingreep (elk komt minstens één keer voor in een week met de passende state).
- [ ] Controleer het dashboard: de nieuwe ingrepen en effecten staan op de kaart "Wat de Kroket God vandaag deed", en "beëindig" werkt op `zegendag`, `klachtenuur` en `schandtitel`.
- [ ] Na de eindreview:
  - scan op geheimen, voeg samen met de live branch en push;
  - de eigenaar deployt met `bash deploy.sh`, met de md5-controle;
  - lees de log: wakker, geen fouten en geen "Niet in de backup".
- [ ] Werk het geheugen bij: premie-cron weg, stille missie zonder beheerder, licht tribunaal, Verbondszegen alleen in de draad, en de `vanaf`-regel voor nieuwe opdrachten.
