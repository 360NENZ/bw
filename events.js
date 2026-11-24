// 历年日期与视觉覆盖范围的证据见 assets/sources.json。
// 每届统一使用用户指定的北京时间每日 08:00–18:00。
(function (root) {
    const icons = Object.freeze(Object.fromEntries([
        [2018, '2018'], [2019, '2018'], [2020, '2020'], [2021, '2020'],
        [2023, '2023'], [2024, null], [2025, null], [2026, null]
    ].map(([year, group]) => [year, Object.freeze({
        icon: group ? `assets/bw-icon-${group}.png` : 'assets/favicon.ico',
        touchIcon: group ? `assets/bw-icon-${group}.png` : 'assets/bw-icon.png'
    })])));
    const records = [
        [2018, '07-20', '07-22', '上海 · 世博展览馆', '欢迎来到 Bilibili World', '#2968ab', 'jpg'],
        [2019, '08-16', '08-18', '广州 · 保利世贸博览馆', '广州站 · 夏日相遇', '#146d9e', 'png'],
        [2020, '08-07', '08-09', '上海 · 国家会展中心', '属于你的世界', '#39689b', 'jpg'],
        [2021, '07-09', '07-11', '上海 · 国家会展中心', '全员宝藏，速速递上', '#ed2b7c', 'jpg'],
        [2023, '07-21', '07-23', '上海 · 国家会展中心', '久等了，全员集结', '#5635df', 'jpg'],
        [2024, '07-12', '07-14', '上海 · 国家会展中心', '盛夏大作战，为热爱而战', '#2b79a7', 'jpg'],
        [2025, '07-11', '07-13', '上海 · 国家会展中心', '爱的链接', '#164da6', 'jpg'],
        [2026, '07-10', '07-12', '上海 · 国家会展中心', '次元新航线', '#1952bb', 'jpg']
    ];
    function createEvent([year, start, end, venue, theme, color, extension = 'jpg'], overrides = {}) {
        const poster = overrides.poster || `assets/bw-${year}-poster.${extension}`;
        return Object.freeze({
            year, status: 'held', startDate: `${year}-${start}`, endDate: `${year}-${end}`, venue, theme, color,
            poster,
            portraitPoster: year === 2019 ? poster : null,
            video: [2019, 2020, 2021, 2024, 2025, 2026].includes(year) ? `assets/bw-${year}-banner.mp4` : null,
            officialUrl: year === 2021 ? 'https://bw.bilibili.com/2021/index.html#/Home' : `https://bw.bilibili.com/${year}/`,
            loop: year !== 2021,
            start: Date.parse(`${year}-${start}T08:00:00+08:00`),
            end: Date.parse(`${year}-${end}T18:00:00+08:00`),
            ...overrides
        });
    }
    const heldEvents = records.map(record => {
        const year = record[0];
        const station = year === 2019 ? { station: 'guangzhou', stationName: '广州站', officialUrl: 'https://bw.bilibili.com/2019/index.html#/guangzhou' }
            : year === 2020 ? { station: 'shanghai', stationName: '上海站', officialUrl: 'https://bw.bilibili.com/2020/index.html#/bw' } : {};
        return [year, createEvent(record, station)];
    });
    const events = Object.freeze(Object.fromEntries([...heldEvents, [2022, Object.freeze({
        year: 2022, status: 'not-held', theme: '等待重逢的夏天',
        venue: '线下活动 · 当年未举办',
        startDate: null, endDate: null, start: null, end: null,
        plannedStartDate: '2022-07-15', plannedEndDate: '2022-07-17',
        announcementDate: '2022-05-23', announcement: 'assets/bw-2022-announcement.jpg',
        poster: null, video: null, color: '#459fe5',
        announcementUrl: 'https://www.onsiteclub.com/case/BW2022-Announced-Delay-Or-That-2022-5-24',
        statusUrl: 'https://baike.baidu.com/en/item/BiliBili%20World/1469626'
    })]]));

    const stations = Object.freeze({
        2019: Object.freeze({
            guangzhou: events[2019],
            shanghai: createEvent([2019, '10-04', '10-06', '上海 · 新国际博览中心', '上海站 · 扬帆起航', '#2674b7'], {
                station: 'shanghai', stationName: '上海站',
                poster: 'assets/bw-2019-shanghai-poster.png', video: 'assets/bw-2019-shanghai-banner.mp4',
                officialUrl: 'https://bw.bilibili.com/2019/index.html#/shanghai'
            }),
            chengdu: createEvent([2019, '12-21', '12-22', '成都 · 世纪城新国际会展中心', '成都站 · 冬日相逢', '#47305f'], {
                station: 'chengdu', stationName: '成都站',
                poster: 'assets/bw-2019-chengdu-poster.png', video: 'assets/bw-2019-chengdu-banner.mp4',
                officialUrl: 'https://bw.bilibili.com/2019/index.html#/chengdu'
            })
        }),
        2020: Object.freeze({
            shanghai: events[2020],
            guangzhou: createEvent([2020, '12-26', '12-27', '广州 · 广交会展馆', '广州站 · 异世界相遇', '#398dae'], {
                station: 'guangzhou', stationName: '广州站',
                poster: 'assets/bw-2020-guangzhou-poster.jpg', video: 'assets/bw-2020-guangzhou-banner.mp4',
                officialUrl: 'https://bw.bilibili.com/2020/index.html#/bwgz'
            })
        })
    });

    function resolveYear(search = '') {
        const params = new URLSearchParams(search);
        const parameter = params.get('year');
        const year = parameter === null ? '2026' : parameter;
        const valid = /^\d{4}$/.test(year);
        const defaultEvent = valid ? events[year] || null : null;
        const station = params.get('station');
        const invalidStation = Boolean(defaultEvent && station !== null && !Object.hasOwn(stations[year] || {}, station));
        return {
            year: valid ? year : null,
            event: invalidStation ? null : station !== null && defaultEvent ? stations[year][station] : defaultEvent,
            invalid: !valid, invalidStation
        };
    }

    function getClock(event, now = Date.now()) {
        // 原定日期仅作历史资料；未举办的年份没有开场、落幕或寄语时机。
        if (!event || event.status === 'not-held') return null;
        const phase = now < event.start ? 'upcoming' : now < event.end ? 'ongoing' : 'ended';
        const duration = phase === 'upcoming' ? event.start - now : now - (phase === 'ongoing' ? event.start : event.end);
        const totalSeconds = Math.floor(Math.max(0, duration) / 1000);
        const hour = new Date(now + 8 * 3600000).getUTCHours();
        return {
            phase,
            values: [Math.floor(totalSeconds / 86400), Math.floor(totalSeconds / 3600) % 24, Math.floor(totalSeconds / 60) % 60, totalSeconds % 60],
            open: hour >= 8 && hour < 18,
            openingStatus: hour < 8 ? '今日尚未开馆' : hour < 18 ? '现场开放中' : '今日已闭馆'
        };
    }

    function shouldShowFarewell(event, now = Date.now()) {
        const clock = getClock(event, now);
        return Boolean(clock && (clock.phase === 'ended' || (clock.phase === 'ongoing' && !clock.open)));
    }

    const api = Object.freeze({ events, stations, icons, resolveYear, getClock, shouldShowFarewell });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BWEvents = api;
})(globalThis);
