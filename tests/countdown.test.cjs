const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { events, stations, resolveYear, getClock, shouldShowFarewell } = require('../events.js');
const time = value => Date.parse(value);

test('默认 2026，年份独立解析；未收录与错误参数不借用其他届数', () => {
    assert.equal(resolveYear('').event, events[2026]);
    assert.equal(resolveYear('?showHours=1').event, events[2026]);
    assert.equal(resolveYear('?year=2025&showHours=1').event, events[2025]);
    assert.equal(resolveYear('?year=2022').event, events[2022]);
    for (const year of ['2017', '2030']) {
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

test('2022 未举办：原定日期不驱动计时或闭馆寄语', () => {
    const event = events[2022];
    assert.equal(event.status, 'not-held');
    assert.equal(event.start, null);
    assert.equal(event.end, null);
    assert.equal(event.startDate, null);
    assert.equal(event.endDate, null);
    assert.equal(event.plannedStartDate, '2022-07-15');
    assert.equal(event.plannedEndDate, '2022-07-17');
    assert.equal(event.announcementDate, '2022-05-23');
    assert.equal(event.poster, null);
    assert.equal(event.video, null);
    for (const date of ['2022-05-22T12:00:00+08:00', '2022-05-23T12:00:00+08:00', '2022-07-15T07:59:59+08:00', '2022-07-15T08:00:00+08:00', '2022-07-15T18:00:00+08:00', '2022-07-17T18:00:00+08:00', '2030-01-01T00:00:00Z']) {
        assert.equal(getClock(event, time(date)), null, date);
        assert.equal(shouldShowFarewell(event, time(date)), false, date);
    }
});

const heldEvents = [...new Set([...Object.values(events), ...Object.values(stations).flatMap(Object.values)])].filter(event => event.status === 'held');
for (const event of heldEvents) {
    test(`${event.year} ${event.stationName || ''} 寄语仅在每天闭馆后或整届落幕后展示，遵循北京时间`, () => {
        const start = event.start;
        for (const [offset, expected] of [
            [-3600000, false], [-1000, false], [0, false],
            [10 * 3600000 - 1000, false], [10 * 3600000, true],
            [16 * 3600000, true], [24 * 3600000 - 1000, true],
            [24 * 3600000, false], [34 * 3600000, true]
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
    assert.deepEqual(Object.keys(events), ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']);
    for (const event of Object.values(events)) {
        const record = sources.years.find(source => source.year === event.year);
        if (event.status === 'not-held') {
            assert.equal(record.status, 'not-held');
            assert.equal(record.dates, null);
            assert.deepEqual(record.plannedDates, [event.plannedStartDate, event.plannedEndDate]);
            assert.equal(record.announcementDate, event.announcementDate);
            assert.equal(record.announcementPage, event.announcementUrl);
            assert.equal(record.statusReference, event.statusUrl);
        } else assert.deepEqual(record.dates, [event.startDate, event.endDate]);
        for (const file of [event.poster, event.video, event.announcement].filter(Boolean)) {
            assert.ok(fs.statSync(path.join(__dirname, '..', file)).size > 10000, file);
            assert.ok(record.assets.some(asset => asset.file === file), file);
        }
    }
    assert.ok(!sources.gaps.some(source => source.year === 2022));
});

test('2019 三站与 2020 两站各自使用日期、场馆和素材，旧链接保持默认站点', () => {
    const expected = [
        [2019, 'guangzhou', '2019-08-16', '2019-08-18', '广州 · 保利世贸博览馆'],
        [2019, 'shanghai', '2019-10-04', '2019-10-06', '上海 · 新国际博览中心'],
        [2019, 'chengdu', '2019-12-21', '2019-12-22', '成都 · 世纪城新国际会展中心'],
        [2020, 'shanghai', '2020-08-07', '2020-08-09', '上海 · 国家会展中心'],
        [2020, 'guangzhou', '2020-12-26', '2020-12-27', '广州 · 广交会展馆']
    ];
    for (const [year, station, start, end, venue] of expected) {
        const event = resolveYear(`?year=${year}&station=${station}&showHours=1`).event;
        assert.equal(event, stations[year][station]);
        assert.equal(event.startDate, start);
        assert.equal(event.endDate, end);
        assert.equal(event.venue, venue);
        assert.equal(getClock(event, time(`${start}T07:59:59+08:00`)).phase, 'upcoming');
        assert.deepEqual(getClock(event, event.start).values, [0, 0, 0, 0]);
        assert.equal(getClock(event, event.end - 1).phase, 'ongoing');
        assert.equal(getClock(event, event.end).phase, 'ended');
        assert.deepEqual(getClock(event, event.end + 1000).values, [0, 0, 0, 1]);
        // 每一天 08:00 开场与 18:00 闭馆；末日之后持续显示寄语。
        for (let day = event.start; day < event.end; day += 86400000) {
            assert.equal(shouldShowFarewell(event, day), false);
            assert.equal(shouldShowFarewell(event, day + 10 * 3600000), true);
        }
    }
    assert.equal(resolveYear('?year=2019').event.station, 'guangzhou');
    assert.equal(resolveYear('?year=2020').event.station, 'shanghai');
    assert.equal(new Set(expected.map(([year, station]) => stations[year][station].video)).size, 5);
    const now = time('2019-10-05T12:00:00+08:00');
    assert.equal(getClock(stations[2019].guangzhou, now).phase, 'ended');
    assert.equal(getClock(stations[2019].shanghai, now).phase, 'ongoing');
    assert.equal(getClock(stations[2019].chengdu, now).phase, 'upcoming');
});

test('错误或不属于该年份的站点不套用默认日期', () => {
    for (const search of ['?year=2019&station=', '?year=2019&station=beijing', '?year=2020&station=chengdu', '?year=2021&station=shanghai', '?year=2022&station=guangzhou', '?station=shanghai', '?year=2019&station=toString']) {
        const result = resolveYear(search);
        assert.equal(result.invalidStation, true, search);
        assert.equal(result.event, null, search);
        assert.equal(shouldShowFarewell(result.event), false, search);
    }
});

test('站点素材与来源清单一致，广州 2020 不混入上海或 BML 日期', () => {
    const sources = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/sources.json')));
    for (const [year, cities] of Object.entries(stations)) {
        const source = sources.years.find(source => String(source.year) === year);
        for (const event of Object.values(cities)) {
            const record = source.stations.find(station => station.station === event.station);
            assert.deepEqual(record.dates, [event.startDate, event.endDate]);
            assert.equal(record.venue, event.venue);
            for (const kind of ['poster', 'video']) {
                assert.equal(record[kind], event[kind]);
                assert.ok(fs.statSync(path.join(__dirname, '..', event[kind])).size > 10000);
                assert.ok(source.assets.some(asset => asset.file === event[kind]));
            }
        }
    }
    assert.match(sources.years.find(source => source.year === 2020).stations.find(station => station.station === 'guangzhou').ticketPage, /id=31820$/);
});
