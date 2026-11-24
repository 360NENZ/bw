// 历年日期与视觉覆盖范围的证据见 assets/sources.json。
// 每届统一使用用户指定的北京时间每日 08:00–18:00。
(function (root) {
    const records = [
        [2018, '07-20', '07-22', '上海 · 世博展览馆', '欢迎来到 Bilibili World', '首页 3D 场景静帧', '#2968ab', 'jpg'],
        [2019, '08-16', '08-18', '广州 · 保利世贸博览馆', '广州站 · 夏日相遇', '广州站主视觉；该年另有上海、成都站', '#146d9e', 'jpg'],
        [2020, '08-07', '08-09', '上海 · 国家会展中心', '属于你的世界', '首页漫画主视觉', '#39689b', 'jpg'],
        [2021, '07-09', '07-11', '上海 · 国家会展中心', '全员宝藏，速速递上', '官网加载背景动画', '#ed2b7c', 'jpg'],
        [2023, '07-21', '07-23', '上海 · 国家会展中心', '久等了，全员集结', '官方主视觉', '#5635df', 'jpg'],
        [2024, '07-12', '07-14', '上海 · 国家会展中心', '盛夏大作战，为热爱而战', '官网主视觉海报', '#2b79a7', 'jpg'],
        [2025, '07-11', '07-13', '上海 · 国家会展中心', '爱的链接', '官网主视觉海报', '#164da6', 'jpg'],
        [2026, '07-10', '07-12', '上海 · 国家会展中心', '次元新航线', '官网主视觉', '#1952bb', 'jpg']
    ];
    const events = Object.freeze(Object.fromEntries(records.map(([year, start, end, venue, theme, visualNote, color, extension]) => [year, Object.freeze({
        year, startDate: `${year}-${start}`, endDate: `${year}-${end}`, venue, theme, visualNote, color,
        poster: `assets/bw-${year}-poster.${extension}`,
        video: [2019, 2020, 2021, 2026].includes(year) ? `assets/bw-${year}-banner.mp4` : null,
        officialUrl: year === 2021 ? 'https://bw.bilibili.com/2021/index.html#/Home' : 'https://bw.bilibili.com/#/',
        start: Date.parse(`${year}-${start}T08:00:00+08:00`),
        end: Date.parse(`${year}-${end}T18:00:00+08:00`)
    })])));

    function resolveYear(search = '') {
        const parameter = new URLSearchParams(search).get('year');
        const year = parameter === null ? '2026' : parameter;
        const valid = /^\d{4}$/.test(year);
        return { year: valid ? year : null, event: valid ? events[year] || null : null, invalid: !valid };
    }

    function getClock(event, now = Date.now()) {
        if (!event) return null;
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

    const api = Object.freeze({ events, resolveYear, getClock, shouldShowFarewell });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BWEvents = api;
})(globalThis);
