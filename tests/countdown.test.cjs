const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { events, resolveYear, getClock, shouldShowFarewell } = require('../events.js');
const time = value => Date.parse(value);

test('默认 2026，年份独立解析；未收录与错误参数不借用其他届数', () => {
    assert.equal(resolveYear('').event, events[2026]);
    assert.equal(resolveYear('?showHours=1').event, events[2026]);
    assert.equal(resolveYear('?year=2025&showHours=1').event, events[2025]);
    for (const year of ['2017', '2022', '2030']) {
        const selection = resolveYear(`?year=${year}`);
        assert.equal(selection.year, year);
        assert.equal(selection.event, null);
        assert.equal(selection.invalid, false);
    }
    for (const value of ['', '25', '2025abc', '2025.0', '%3Cscript%3E', '%202025']) {
        assert.equal(resolveYear(`?year=${value}`).invalid, true, value);
        assert.equal(resolveYear(`?year=${value}`).event, null, value);
    }
    assert.equal(getClock(null), null);
    assert.equal(shouldShowFarewell(null), false);
});

test('2026 开场前一秒倒计时，08:00 开场起连续记录', () => {
    assert.equal(getClock(events[2026], time('2026-07-10T07:59:59+08:00')).phase, 'upcoming');
    assert.deepEqual(getClock(events[2026], time('2026-07-10T07:59:59+08:00')).values, [0, 0, 0, 1]);
    const opening = getClock(events[2026], time('2026-07-10T08:00:00+08:00'));
    assert.equal(opening.phase, 'ongoing');
    assert.equal(opening.openingStatus, '现场开放中');
    assert.deepEqual(opening.values, [0, 0, 0, 0]);
    assert.deepEqual(getClock(events[2026], time('2026-07-11T08:00:00+08:00')).values, [1, 0, 0, 0]);
});

test('2026 整届落幕重置为正计时，长期天数不截断', () => {
    const before = getClock(events[2026], time('2026-07-12T17:59:59+08:00'));
    assert.equal(before.phase, 'ongoing');
    assert.deepEqual(before.values, [2, 9, 59, 59]);
    const ended = getClock(events[2026], time('2026-07-12T18:00:00+08:00'));
    assert.equal(ended.phase, 'ended');
    assert.deepEqual(ended.values, [0, 0, 0, 0]);
    assert.deepEqual(getClock(events[2026], time('2030-01-01T00:00:00+08:00')).values, [1268, 6, 0, 0]);
});

test('选中历史年份使用真实日期：2020 在 8 月，2019 为广州站', () => {
    assert.equal(getClock(events[2020], time('2020-07-10T08:00:00+08:00')).phase, 'upcoming');
    assert.equal(getClock(events[2020], time('2020-08-07T08:00:00+08:00')).phase, 'ongoing');
    assert.deepEqual(getClock(events[2020], time('2020-08-09T18:00:01+08:00')).values, [0, 0, 0, 1]);
    assert.equal(events[2019].venue, '广州 · 保利世贸博览馆');
    assert.equal(events[2019].startDate, '2019-08-16');
    assert.equal(events[2025].startDate, '2025-07-11');
    assert.equal(events[2025].endDate, '2025-07-13');
});

for (const event of Object.values(events)) {
    test(`${event.year} 寄语仅在每天闭馆后或整届落幕后展示，遵循北京时间`, () => {
        const start = event.start;
        for (const [offset, expected] of [
            [-3600000, false], [-1000, false], [0, false],
            [10 * 3600000 - 1000, false], [10 * 3600000, true],
            [16 * 3600000, true], [24 * 3600000 - 1000, true],
            [24 * 3600000, false], [34 * 3600000, true],
            [48 * 3600000 - 1000, true], [48 * 3600000, false]
        ]) assert.equal(shouldShowFarewell(event, start + offset), expected, `${event.year}: ${offset}`);
        assert.equal(shouldShowFarewell(event, event.end - 1000), false);
        assert.equal(shouldShowFarewell(event, event.end), true);
        assert.equal(shouldShowFarewell(event, event.end + 86400000), true);
        const utcStart = time(`${event.startDate}T00:00:00Z`);
        assert.equal(getClock(event, utcStart).openingStatus, '现场开放中');
    });
}

test('所有收录年份都有本地素材与一致的来源日期，不将缺失年份标为已收录', () => {
    const sources = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/sources.json')));
    assert.deepEqual(Object.keys(events), ['2018', '2019', '2020', '2021', '2023', '2024', '2025', '2026']);
    for (const event of Object.values(events)) {
        const record = sources.years.find(source => source.year === event.year);
        assert.deepEqual(record.dates, [event.startDate, event.endDate]);
        for (const file of [event.poster, event.video].filter(Boolean)) {
            assert.ok(fs.statSync(path.join(__dirname, '..', file)).size > 10000, file);
            assert.ok(record.assets.some(asset => asset.file === file), file);
        }
    }
    assert.ok(!events[2022]);
});
