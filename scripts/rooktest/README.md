# Rooktest-harnas: de echte bot met een nep-Slack

`harnas.js` is een module die `index.js` (uit de repo-root) laadt met:
- een nep-`@slack/bolt` (via `require.cache`), dat elke `chat.*`-aanroep vastlegt in `posts` en `updates`;
- een nep-`node-fetch`, dat alleen een PUT naar R2 laat lukken en de rest laat falen, en `GROQ_BASE_URL` naar een geweigerde localhost-poort (groq-sdk gebruikt zijn eigen HTTP-laag, niet node-fetch). Alle andere providers hebben geen sleutel of gaan via node-fetch, dus de LLM-keten faalt snel zonder netwerk en de bot valt terug op vaste teksten;
- een eigen tijdelijke statemap (`KROKET_STATE_DIR`), gevuld uit `seed-state/` (6 leden UA..UF, Alfa..Foxtrot, allemaal verzonnen).

Elk rooktest-script is een eigen bestand in deze map en roept het harnas zo aan:

```js
require('./harnas.js')(async (h) => {
  h.schrijf('instellingen.json', { stilModus: false });
  await h.klik('bamischijf_aanval', 'UA');
  h.ok(h.posts.length > 0, 'er is iets gepost');
});
```

Draaien (vanuit de repo-root): `node scripts/rooktest/<script>.js`. Het harnas sluit zelf af met exitcode 0 als elke `ok` slaagde en 1 als er een faalde of de test een fout gooide. Rooktests heten bewust geen `*.test.js`, dus `npm test` draait ze niet.

## Wat `h` bevat

- `klik(actionId, userId, extra)`: drukt een knop in, bijvoorbeeld `klik('wapen_kies', 'UA', { selected_option: { value: 'kroketmes' } })`.
- `commando(userId, tekst)`: draait `/kroketgod <tekst>` en geeft het antwoord als tekst terug.
- `lees(bestand)` en `schrijf(bestand, data)`: de JSON-state in de tijdelijke map.
- `posts` (alle `chat.postMessage`, met `text`, `blocks`, `thread`, `ts`) en `updates` (alle `chat.update`).
- `ok(voorwaarde, omschrijving)`: print ✔ of ✖ en zet de exitcode op 1 bij een falende voorwaarde.
- `gebeurtenis(naam, event)`: vuurt een Slack-event af (`app.event`), bijvoorbeeld `gebeurtenis('message', { user, text, channel: 'CKANAAL', ts })`.
- `wacht(ms)`, `client` (de nep-Slack-client), `index` (wat `index.js` exporteert onder `KROKET_ROOKTEST`: `regieTik`, `bouwRegieStand`, `voerIngreepUit`, `UITVOERDERS`, `regieStaat`, `bewaarRegie`, `mogAutonoomPosten`, `werkdagenStil`), `state` en `uitmap` (de paden), `r2` (de nep-uploads), `handlers`, `schakel.faalPost` (zet op `true` en `chat.postMessage` gooit, om een mislukte post te testen).

Opties: `harnas(test, { opstartMs })` wacht standaard 2500 ms op de opstart van de bot.

## Valkuilen

- `GROQ_API_KEY` moet niet leeg zijn. Het harnas zet een nepwaarde plus een onbereikbare `GROQ_BASE_URL`; LLM-aanroepen falen dan meteen (connection refused). De tijdelijke `rooktest-*`-mappen worden bij het afsluiten opgeruimd.
- Een commando werkt alleen met `channel_name: 'kroket-illuminati'` (daar zorgt `commando` voor).
- Zet de state die je test zelf neer (`schrijf`) voordat je klikt; bij het opstarten krijgt iedereen 5 punten zakgeld.
- `casinobonus.json` en andere dagsleutels gebruiken de echte klok (`dagSleutel()`), ook als je een tik met een eigen `nu` draait.
- macOS heeft geen `timeout`-commando; het harnas doet zelf `process.exit()`.
- De repo is publiek: zet geen echte namen, Slack-ids of tokens in `seed-state/` of in een script.
