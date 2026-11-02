import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSyoboiProgramRows,
  normalizeSyoboiPrograms,
  parseSyoboiDate
} from '../../lib/syoboi-calendar.mjs';

const fixedNow = new Date('2026-11-01T00:00:00.000Z');

test('extracts programme rows from keyed RSS2 JSON payloads', () => {
  const rows = extractSyoboiProgramRows({
    channel: {
      programs: {
        '7001': { PID: 7001, TID: 101, Title: 'Frieren', StTimeU: 1793646000 },
        '7002': { PID: 7002, TID: 102, Title: 'Spy x Family', StTimeU: 1793653200 }
      }
    }
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => String(row.PID)).sort(), ['7001', '7002']);
});

test('uses RSS2 programme title when the chained Syoboi title lookup is empty', () => {
  const programRows = [{
    PID: 7001, TID: 101, StTime: '20261102_200000',
    Count: '1', ChName: 'TOKYO MX', SubTitle2: 'First episode'
  }];
  const feedRows = [{
    PID: 7001, TID: 101, Title: 'Frieren: Beyond Journey’s End',
    ShortTitle: 'Sousou no Frieren', StTimeU: 1793646000, Cat: 1
  }];

  const programs = normalizeSyoboiPrograms(programRows, [], feedRows, fixedNow);
  assert.equal(programs.length, 1);
  assert.equal(programs[0].title, 'Frieren: Beyond Journey’s End');
  assert.equal(programs[0].shortTitle, 'Sousou no Frieren');
  assert.equal(programs[0].channel, 'TOKYO MX');
  assert.equal(programs[0].episode, 1);
  assert.equal(programs[0].titleUnavailable, false);
  assert.equal(programs[0].date, '2026-11-02');
  assert.equal(programs[0].time, '20:00');
});

test('keeps a valid broadcast visible when both title sources are empty', () => {
  const programs = normalizeSyoboiPrograms([{
    PID: 8123, TID: 456, StTime: '20261102_210000', ChName: 'BS11'
  }], [], [], fixedNow);

  assert.equal(programs.length, 1);
  assert.equal(programs[0].title, 'Anime broadcast #456');
  assert.equal(programs[0].titleUnavailable, true);
});

test('prefers the full Syoboi title record over its RSS title', () => {
  const programs = normalizeSyoboiPrograms(
    [{ PID: 91, TID: 7, StTime: '20261102_220000' }],
    [{ TID: 7, Title: 'Official full title', ShortTitle: 'Short title', FirstYear: 2026, FirstMonth: 10 }],
    [{ PID: 91, TID: 7, Title: 'RSS title', StTimeU: 1793653200 }],
    fixedNow
  );
  assert.equal(programs[0].title, 'Official full title');
  assert.equal(programs[0].firstAired, '2026-10');
});

test('parses Syoboi compact Japan-local timestamps and Unix epochs', () => {
  assert.equal(parseSyoboiDate('20261102_200000').toISOString(), '2026-11-02T11:00:00.000Z');
  assert.equal(parseSyoboiDate('1793646000').toISOString(), new Date(1793646000 * 1000).toISOString());
  assert.equal(parseSyoboiDate('not-a-date'), null);
});
