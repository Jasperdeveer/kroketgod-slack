// Tests voor middernacht in een andere tijdzone: Gemini zet zijn dagquota om middernacht
// Pacific-tijd terug, en de VS wisselen op een andere zondag van zomertijd dan wij. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { volgendeMiddernachtPacific, volgendeMiddernachtIn } = require('./tijd.js');

const iso = (ms) => new Date(ms).toISOString();
const op = (s) => volgendeMiddernachtPacific(Date.parse(s));

test('zomertijd: middernacht Pacific is 07:00 UTC', () => {
  assert.equal(iso(op('2026-10-21T10:00:00Z')), '2026-10-22T07:00:00.000Z');
  assert.equal(iso(op('2026-10-22T06:59:59Z')), '2026-10-22T07:00:00.000Z');
});

test('precies op middernacht telt de volgende dag', () => {
  assert.equal(iso(op('2026-10-22T07:00:00Z')), '2026-10-23T07:00:00.000Z');
});

test('over de wisseling naar wintertijd heen (VS: 1 november 2026)', () => {
  assert.equal(iso(op('2026-10-31T23:00:00Z')), '2026-11-01T07:00:00.000Z');
  assert.equal(iso(op('2026-11-01T12:00:00Z')), '2026-11-02T08:00:00.000Z');
});

test('over de wisseling naar zomertijd heen (VS: 8 maart 2026)', () => {
  assert.equal(iso(op('2026-03-08T07:30:00Z')), '2026-03-08T08:00:00.000Z');
  assert.equal(iso(op('2026-03-08T12:00:00Z')), '2026-03-09T07:00:00.000Z');
});

test('werkt ook voor andere zones', () => {
  assert.equal(iso(volgendeMiddernachtIn('Europe/Amsterdam', Date.parse('2026-10-21T10:00:00Z'))), '2026-10-21T22:00:00.000Z');
  assert.equal(iso(volgendeMiddernachtIn('UTC', Date.parse('2026-10-21T10:00:00Z'))), '2026-10-22T00:00:00.000Z');
});
