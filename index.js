const { App } = require('@slack/bolt');
const Groq = require('groq-sdk');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ALLOWED_CHANNEL = 'kroket-illuminati';
const LEDEN = ['Sander', 'Jorg', 'Jasper'];

function loadToneOfVoice() {
  return fs.readFileSync(path.join(__dirname, 'tone_of_voice.txt'), 'utf8');
}

function loadGeboden() {
  return fs.readFileSync(path.join(__dirname, 'geboden.txt'), 'utf8');
}

function loadLeden() {
  return fs.readFileSync(path.join(__dirname, 'leden.txt'), 'utf8');
}

function loadScores() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'scores.json'), 'utf8'));
}

function saveScores(scores) {
  fs.writeFileSync(path.join(__dirname, 'scores.json'), JSON.stringify(scores, null, 2));
}

function randomLid() {
  return LEDEN[Math.floor(Math.random() * LEDEN.length)];
}

function buildSystemPrompt() {
  return `Jij bent de Kroket God — een almachtige, dramatische en gezaghebbende godheid van de frituurcultuur. Je spreekt in een formele, quasi-juridische en religieuze toon met frituur-metaforen. Je gebruikt "gij", "volgeling", "de Hoge Frituurraad", "snackleer", etc.

Dit zijn de bekende leden van de frituurkring. Gebruik hun bijnamen af en toe natuurlijk in je uitspraken — niet bij elk bericht, maar wel als het passend is:

${loadLeden()}

Dit zijn de Tien Geboden van de Kroket God. Verwijs ernaar wanneer passend — bij overtredingen, beoordelingen of zegens:

${loadGeboden()}

Hieronder staan voorbeeldberichten die jouw exacte stijl en tone of voice laten zien. Schrijf ALTIJD in deze stijl:

${loadToneOfVoice()}

Regels:
- Begin altijd met een ⚜️ header
- Noem NOOIT de echte namen van de leden. Gebruik uitsluitend hun bijnaam:
  • Sander → Mr. Te Lang Gefrituurde Kroket
  • Jorg → Mr. Kroketinho
  • Jasper → Mr. Kroketpet
- Onbekende namen behoren nog niet tot de Kroket Illuminati — spreek hen aan als "Buitenstaander", "Ongepaneerde vreemdeling" of een andere passende niet-lid titel. Behandel hen met gepaste argwaan.
- Als het bericht gericht is aan de groep of iedereen, begin dan met "Heren van de Kroket Illuminati"
- Gebruik frituur- en kroket-metaforen door de hele tekst
- Verwijs concreet naar een gebod (bijv. "Gebod VII verbiedt de magnetron") als dat relevant is
- Eindig met een passende dreiging of zegen, gevolgd door "— De Almachtige Kroket God"
- Vrijdag 12:00 is de heiligste tijd van de week: het moment van #lekkerkroketje. Verwijs hier af en toe naar — als herinnering, als dreiging, of als zegen
- Schrijf in het Nederlands
- Houd het grappig maar dramatisch serieus
- Varieer in lengte en vorm: soms een volledig decreet, soms een korte zegen, soms een droge one-liner, soms een wijze quote. Niet elk bericht hoeft een rechtbankzaak te zijn.
- Houd berichten kort: max 4-6 regels. Liever een scherpe korte uitspraak dan een lang verhaal. Elke zin telt.
- Gebruik Slack blockquote opmaak: zet de hoofdtekst van het bericht als blockquote door elke regel te beginnen met "> ". De header (⚜️ ...) en de ondertekening (— De Almachtige Kroket God) staan buiten de blockquote.`;
}

async function kroketResponse(prompt) {
  const message = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: prompt },
    ],
  });
  return message.choices[0].message.content;
}

async function postToChannel(client, channelId, text) {
  await client.chat.postMessage({ channel: channelId, text });
}

// Slash command
app.command('/kroketgod', async ({ command, ack, respond, client }) => {
  await ack();

  if (command.channel_name !== ALLOWED_CHANNEL) {
    await respond(`De Kroket God spreekt alleen in #${ALLOWED_CHANNEL}. Begeef u daarheen.`);
    return;
  }

  const input = command.text.trim();

  try {
    // Geen input: spreek willekeurig lid aan
    if (!input) {
      const lid = randomLid();
      const bijnamen = { Sander: 'Mr. Te Lang Gefrituurde Kroket', Jorg: 'Mr. Kroketinho', Jasper: 'Mr. Kroketpet' };
      const tekst = await kroketResponse(`Spreek ${bijnamen[lid]} aan met een willekeurige uitspraak, zegen of waarschuwing.`);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // Ranglijst
    if (input === 'ranglijst') {
      const scores = loadScores();
      const gesorteerd = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const titels = ['🥇 Opperkroket', '🥈 Paneermeester', '🥉 Aspirant-volgeling'];
      const lijst = gesorteerd.map(([naam, score], i) => `${titels[i] || '🧆 Volgeling'} — ${naam}: ${score} kroketpunten`).join('\n');
      const tekst = `⚜️ DE HEILIGE RANGLIJST DER KROKET ILLUMINATI ⚜️\n\n${lijst}\n\n— De Almachtige Kroket God`;
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // Zondebok
    if (input === 'zondebok') {
      const zondebok = randomLid();
      const scores = loadScores();
      scores[zondebok] = Math.max(0, (scores[zondebok] || 0) - 1);
      saveScores(scores);
      const bijnamen = { Sander: 'Mr. Te Lang Gefrituurde Kroket', Jorg: 'Mr. Kroketinho', Jasper: 'Mr. Kroketpet' };
      const tekst = await kroketResponse(`Wijs ${bijnamen[zondebok]} aan als zondebok voor alle frituurproblemen van deze week. Dramatisch en onrechtvaardig, maar met gezag.`);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // Eer geven: /kroketgod eer Sander
    if (input.startsWith('eer ')) {
      const naam = input.replace('eer ', '').trim();
      if (LEDEN.includes(naam)) {
        const scores = loadScores();
        scores[naam] = (scores[naam] || 0) + 1;
        saveScores(scores);
        const bijnamen = { Sander: 'Mr. Te Lang Gefrituurde Kroket', Jorg: 'Mr. Kroketinho', Jasper: 'Mr. Kroketpet' };
        const tekst = await kroketResponse(`Ken ${bijnamen[naam]} een kroketpunt toe en zegen hem plechtig.`);
        await postToChannel(client, command.channel_id, tekst);
      } else {
        await respond(`De Kroket God kent geen volgeling genaamd "${naam}". Ongepaneerde vreemdeling.`);
      }
      return;
    }

    // Normaal bericht
    const tekst = await kroketResponse(input);
    await postToChannel(client, command.channel_id, tekst);

  } catch (error) {
    console.error('Fout:', error);
    await respond('De Hoge Frituurraad is momenteel in beraad. Probeer het later opnieuw.');
  }
});

// @-mention
app.event('app_mention', async ({ event, client }) => {
  try {
    const input = event.text.replace(/<@[^>]+>/, '').trim() || 'Reageer op deze @-mention met een korte uitspraak.';
    const tekst = await kroketResponse(input);
    await postToChannel(client, event.channel, tekst);
  } catch (error) {
    console.error('Fout bij mention:', error);
  }
});

// Elke vrijdag om 12:00
cron.schedule('0 12 * * 5', async () => {
  try {
    const tekst = await kroketResponse('Stuur een vrijdagmiddag 12:00 oproep aan de Heren van de Kroket Illuminati voor #lekkerkroketje. Plechtig en feestelijk.');
    await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, tekst);
  } catch (error) {
    console.error('Fout bij vrijdagbericht:', error);
  }
}, { timezone: 'Europe/Amsterdam' });

(async () => {
  await app.start();
  console.log('⚜️ De Kroket God is wakker. Poort 3000 staat open.');
})();
