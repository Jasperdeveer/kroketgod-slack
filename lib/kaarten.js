// ── Gele en rode kaarten: wat een kaart kost ─────────────────────────────────
//
// 🟨 GELE KAART  een uur schorsing.
// 🟥 RODE KAART  een dag schorsing.
//
// Een rode kaart wordt niet los uitgedeeld: hij is de TWEEDE gele kaart in dezelfde week. Wie
// deze week al geel kreeg en opnieuw een kaart verdient, krijgt rood. Dat geldt ook voor de
// derde en elke volgende: er is geen escalatie meer boven de dag (de oude reeks 4u → 8u → 24u
// → 48u is vervallen, want "geel is een uur, rood is een dag" moet in één zin uit te leggen zijn).
//
// De week is de Amsterdamse week (maandag als sleutel, zie lib/tijd.js getMondayOfWeek).
//
// Het dossier per lid in geleKaarten.json: { kaarten: [{ ts, reden, weekSleutel, kleur }] }.
// Kaarten van vóór deze regel hebben geen `kleur` en tellen als geel. Een oud `bannenDezeWeek`
// veld mag blijven staan; niemand leest het nog.
//
// Puur: geen I/O en geen klok — de aanroeper geeft de week mee. Zie kaarten.test.js.

'use strict';

const GELE_KAART_UREN = 1;
const RODE_KAART_UREN = 24;

const isGeel = (k) => (k?.kleur || 'geel') === 'geel';

// Aantal gele kaarten in het dossier, deze week of (zonder week) in totaal.
function geleKaarten(dossier, week = null) {
  return (dossier?.kaarten || []).filter(k => isGeel(k) && (!week || k.weekSleutel === week)).length;
}

// Welke kleur krijgt de kaart die nu wordt uitgedeeld? Rood zodra er deze week al geel lag.
// Alleen gele kaarten tellen: is de gele weggestreept door de Zachte Hand, dan begint het
// opnieuw bij geel, ook als er deze week al een rode lag.
function kleurVoorNieuweKaart(dossier, week) {
  return geleKaarten(dossier, week) > 0 ? 'rood' : 'geel';
}

function schorsingUren(kleur) {
  return kleur === 'rood' ? RODE_KAART_UREN : GELE_KAART_UREN;
}

// Een nieuw dossier met de kaart erbij. Laat het meegegeven dossier ongemoeid.
function voegKaartToe(dossier, { kleur, reden, week, ts }) {
  return {
    ...(dossier || {}),
    kaarten: [...(dossier?.kaarten || []), { ts, reden, weekSleutel: week, kleur }],
  };
}

// Streept de meest recente gele kaart weg. Geeft { dossier, weg } terug; weg is null als er
// geen gele kaart was. Een rode kaart blijft staan: de Zachte Hand schrapt alleen geel.
function zonderLaatsteGeleKaart(dossier) {
  const kaarten = [...(dossier?.kaarten || [])];
  for (let i = kaarten.length - 1; i >= 0; i--) {
    if (!isGeel(kaarten[i])) continue;
    const [weg] = kaarten.splice(i, 1);
    return { dossier: { ...(dossier || {}), kaarten }, weg };
  }
  return { dossier, weg: null };
}

module.exports = {
  GELE_KAART_UREN, RODE_KAART_UREN,
  geleKaarten, kleurVoorNieuweKaart, schorsingUren, voegKaartToe, zonderLaatsteGeleKaart,
};
