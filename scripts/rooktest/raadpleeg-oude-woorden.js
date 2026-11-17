// Rooktest: de oude tekstcommando's zijn weg; hun woorden vallen door naar de vrije vraag (zonder taalmodel: de vaste melding).
// Run: `node scripts/rooktest/raadpleeg-oude-woorden.js`.
'use strict';
const harnas = require('./harnas.js');

const GESCHRAPT = ['orakel', 'horoscoop', 'bs', 'mop', 'biecht', 'canoniseer', 'slachtoffer', 'gebod', 'bekeer', 'hoelang', 'vrijdag', 'weer', 'feitje', 'quiz', 'complot', 'meld', 'advies', 'quote', 'nieuws', 'straf'];
const WOORDEN = ['orakel', 'orakel wordt het wat', 'horoscoop', 'bs', 'mop', 'vertel een mop', 'biecht ik at ketchup', 'canoniseer Bravo', 'slachtoffer', 'gebod 11', 'bekeer Bravo', 'hoelang', 'vrijdag', 'weer', 'feitje', 'quiz', 'complot', 'meld Bravo', 'advies', 'straf Bravo', 'rap de snackleer'];
const RITUELEN = ['horoscoop', 'biecht', 'orakel', 'canoniseer']; // elk woord dat met een ritueel begint krijgt de tip
const metTip = (woord) => RITUELEN.includes(woord.split(' ')[0]);
const OUD = /Tien Geboden|Geordende Kring|Wie meldt u aan|onvoldoende bewijs|examenvraag|Het Orakel zwijgt/;

harnas(async (h) => {
  h.schrijf('instellingen.json', { weekendRust: false });
  for (const woord of WOORDEN) {
    const antwoord = await h.commando('UA', woord);
    h.ok(/tijdelijk overbelast/.test(antwoord), `"${woord}" eindigt bij de vrije vraag: ${antwoord.trim()}`);
    h.ok(!/Onbekend commando/.test(antwoord) && !OUD.test(antwoord), `"${woord}": geen foutmelding, geen oude handlertekst`);
    h.ok(/raadpleeg \w+/.test(antwoord) === metTip(woord), `"${woord}": tip naar raadpleeg ${metTip(woord) ? 'aanwezig' : 'afwezig'}`);
  }
  const { BINGO_POOL } = require('../../index.js');
  h.ok(BINGO_POOL.length === 14, 'bingo: 14 vakjes (12 + zelflof van spoor 3 + bedelvak van deel B)');
  for (const t of ['Raadpleeg het orakel en zie de voorspelling uitkomen', 'Biecht via raadpleeg een kroket-zonde op die u nog nooit heeft gedeeld', 'Win een duel op een gunstige horoscoop']) {
    h.ok(BINGO_POOL.includes(t), `bingo bevat: ${t}`);
  }
  const help = await h.commando('UA', 'help');
  h.ok(help.includes('/kroketgod raadpleeg'), 'help noemt /kroketgod raadpleeg');
  for (const w of GESCHRAPT) h.ok(!new RegExp('/kroketgod ' + w + '\\b').test(help), `help noemt /kroketgod ${w} niet`);
});
