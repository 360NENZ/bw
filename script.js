const selection = BWEvents.resolveYear(location.search);
const currentEvent = selection.event;
const showOpeningHours = new URLSearchParams(location.search).get('showHours') === '1';
const element = id => document.getElementById(id);
const backgroundPoster = document.createElement('img');
backgroundPoster.id = 'backgroundPoster';
backgroundPoster.className = 'background-poster';
backgroundPoster.alt = '';
backgroundPoster.decoding = 'async';
backgroundPoster.hidden = true;
backgroundPoster.addEventListener('load', () => {
    document.documentElement.dataset.posterOrientation = backgroundPoster.naturalHeight > backgroundPoster.naturalWidth ? 'portrait' : 'landscape';
});
document.querySelector('.background').prepend(backgroundPoster);

element('brandYear').textContent = selection.year || '年份无效';
element('eventYear').textContent = selection.year || '';
element('eventTag').textContent = selection.year ? `BW ${selection.year}` : 'BW';
element('selectedYear').textContent = selection.year || '选择年份';
element('yearPicker').hidden = false;
element('openingHours').hidden = currentEvent?.status !== 'held' || !showOpeningHours;

function yearUrl(year) {
    const url = new URL(location.href);
    url.searchParams.set('year', year);
    url.hash = '';
    return url.href;
}
Object.values(BWEvents.events).reverse().forEach(event => {
    const link = document.createElement('a');
    link.href = yearUrl(event.year);
    link.textContent = String(event.year);
    if (event.status === 'not-held') {
        link.title = `BW ${event.year} · 当年未举办`;
        const status = document.createElement('span');
        status.className = 'year-status';
        status.textContent = '未举办';
        link.append(status);
    }
    if (event === currentEvent) link.setAttribute('aria-current', 'page');
    element('yearLinks').append(link);
});
element('returnLink').href = yearUrl(2026);

if (currentEvent) {
    document.title = `Bilibili World ${currentEvent.year} · ${currentEvent.theme}`;
    element('themeName').textContent = currentEvent.theme;
    element('venue').textContent = currentEvent.venue;
    const startDate = currentEvent.startDate || currentEvent.plannedStartDate;
    const endDate = currentEvent.endDate || currentEvent.plannedEndDate;
    element('startDate').dateTime = startDate;
    element('startDate').textContent = startDate.replaceAll('-', '.');
    element('endDate').dateTime = endDate;
    element('endDate').textContent = endDate.slice(5).replace('-', '.');
    element('farewellBadge').textContent = `哔哩哔哩 · BilibiliWorld ${currentEvent.year}`;
    if (currentEvent.officialUrl) element('officialLink').href = currentEvent.officialUrl;
    if (currentEvent.poster) {
        document.documentElement.style.setProperty('--poster', `url("${currentEvent.poster}")`);
        backgroundPoster.src = currentEvent.poster;
        backgroundPoster.hidden = false;
        element('backgroundVideo').poster = currentEvent.poster;
    }
    document.documentElement.style.setProperty('--background-color', currentEvent.color);
    document.documentElement.dataset.year = currentEvent.year;
    document.documentElement.dataset.eventStatus = currentEvent.status;
    document.querySelector('meta[name="theme-color"]').content = currentEvent.color;
    if (currentEvent.video) element('backgroundVideo').dataset.src = currentEvent.video;
    if (currentEvent.status === 'not-held') {
        document.title = `Bilibili World ${currentEvent.year} · 当年未举办`;
        element('countdown').dataset.phase = 'not-held';
        element('countdownPanel').hidden = true;
        element('historyPanel').hidden = false;
        element('dateLabel').hidden = false;
        element('eventTimezone').hidden = true;
        element('announcementLink').hidden = false;
        element('announcementLink').href = currentEvent.announcement;
        element('announcementDate').dateTime = currentEvent.announcementDate;
        element('announcementDate').textContent = currentEvent.announcementDate.replaceAll('-', '.');
        element('announcementSource').href = currentEvent.announcementUrl;
        element('statusSource').href = currentEvent.statusUrl;
        element('nextEventLink').href = yearUrl(2023);
    }
} else {
    document.title = selection.invalid ? 'BW · 年份参数无效' : `BW ${selection.year} · 暂未收录`;
    element('themeName').textContent = '回望历年 BW';
    element('eventLocation').hidden = true;
    element('eventDate').hidden = true;
    element('countdownPanel').hidden = true;
    element('unavailablePanel').hidden = false;
    element('countdown').dataset.phase = 'unavailable';
    element('unavailableTitle').textContent = selection.invalid ? '年份参数需要四位数字' : `BW ${selection.year} 暂未收录`;
    element('unavailableMessage').textContent = selection.invalid ? '例如在链接中使用 ?year=2025。也可以从右上角选择已收录年份。' : '请选择其他年份，继续回望与 BW 的时光。';
}

document.addEventListener('click', event => {
    if (!element('yearPicker').contains(event.target)) element('yearPicker').open = false;
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && element('yearPicker').open) {
        element('yearPicker').open = false;
        element('yearPicker').querySelector('summary').focus();
    }
});

const timeFields = ['days', 'hours', 'minutes', 'seconds'].map(element);
const countdownTitle = element('countdownTitle');
const eventStatus = element('eventStatus');
const countdownNote = element('countdownNote');
const timerGrid = element('timerGrid');
let lastState;
let fitFrame;

function fitTimeFields() {
    fitFrame = null;
    if (currentEvent?.status !== 'held') return;
    // 先恢复响应式字号，再按当前字体的真实字宽测量；不裁剪或截断天数。
    timeFields.forEach(field => field.style.removeProperty('font-size'));
    const sizes = timeFields.map(field => {
        const range = document.createRange();
        range.selectNodeContents(field);
        return {
            available: field.getBoundingClientRect().width - 1,
            width: range.getBoundingClientRect().width,
            fontSize: parseFloat(getComputedStyle(field).fontSize)
        };
    });
    sizes.forEach(({ available, width, fontSize }, index) => {
        if (available > 0 && width > available) {
            timeFields[index].style.fontSize = `${Math.floor(fontSize * available / width * 100) / 100}px`;
        }
    });
}

function scheduleTimeFit() {
    if (currentEvent?.status === 'held' && fitFrame == null) fitFrame = requestAnimationFrame(fitTimeFields);
}
if (currentEvent?.status === 'held') {
    if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleTimeFit).observe(timerGrid);
    window.addEventListener('resize', scheduleTimeFit);
    document.fonts?.ready.then(scheduleTimeFit);
    document.fonts?.addEventListener('loadingdone', scheduleTimeFit);
}

function shouldShowFarewell(now = Date.now()) {
    return BWEvents.shouldShowFarewell(currentEvent, now);
}

function updateCountdown(now = Date.now()) {
    const clock = BWEvents.getClock(currentEvent, now);
    if (!clock) return;
    const { phase, values, openingStatus, open } = clock;
    timeFields.forEach((field, index) => {
        const value = String(values[index]).padStart(index === 0 ? 3 : 2, '0');
        if (field.textContent !== value) {
            field.textContent = value;
            if (index === 0) timerGrid.style.setProperty('--days-column', `${value.length / 2}fr`);
        }
    });
    scheduleTimeFit();
    const state = phase === 'ongoing' ? `${phase}:${openingStatus}` : phase;
    if (state !== lastState) {
        const copy = {
            upcoming: [`距 BW ${currentEvent.year} 开场还有`, '准备启航', '下一站，与你在现场相见。'],
            ongoing: [`BW ${currentEvent.year} 已开场`, openingStatus, open ? '相遇正在发生，尽情享受这场夏日的梦。' : `${showOpeningHours ? '每日 08:00–18:00 开放，' : ''}期待与你在现场相见。`],
            ended: [`距 BW ${currentEvent.year} 落幕已经`, '期待再会', '旅途虽已到站，热爱仍在继续。']
        }[phase];
        countdownTitle.textContent = copy[0];
        eventStatus.textContent = copy[1];
        countdownNote.textContent = copy[2];
        element('countdown').dataset.phase = phase;
        lastState = state;
    }
}
updateCountdown();
if (currentEvent?.status === 'held') setInterval(() => updateCountdown(), 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });

const video = element('backgroundVideo');
// 即使页面保留了旧版 loop 属性，也只播放一遍。
video.loop = false;
const motionBtn = element('motionBtn');
const motionLabel = element('motionLabel');
const motionIcon = element('motionIcon');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let videoFailed = false;
let userPaused = false;

function updateMotionButton() {
    const playing = !video.paused && !video.ended;
    motionLabel.textContent = video.ended ? '重播背景' : playing ? '暂停背景' : '播放背景';
    motionBtn.title = motionLabel.textContent;
    motionIcon.setAttribute('d', playing ? 'M9 5v14M15 5v14' : 'm8 5 11 7-11 7Z');
}
function playBackground(replay = false) {
    if (videoFailed || !currentEvent?.video) return;
    if (video.ended && !replay) return;
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    if (video.ended) video.currentTime = 0;
    video.play().catch(updateMotionButton);
}
video.addEventListener('playing', () => { video.classList.add('is-playing'); updateMotionButton(); });
video.addEventListener('pause', updateMotionButton);
video.addEventListener('ended', () => {
    // 2021 加载动画结尾淡出，结束后展示完整主图。
    if (currentEvent?.year === 2021) video.classList.remove('is-playing');
    updateMotionButton();
});
video.addEventListener('error', () => {
    videoFailed = true;
    video.classList.remove('is-playing');
    motionBtn.hidden = true;
});
motionBtn.addEventListener('click', () => {
    userPaused = !video.paused && !video.ended;
    if (userPaused) video.pause();
    else playBackground(true);
});
reducedMotion.addEventListener('change', event => {
    if (event.matches) video.pause();
    else if (!userPaused && !document.hidden) playBackground();
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else if (!userPaused && !reducedMotion.matches) playBackground();
});
motionBtn.hidden = !currentEvent?.video;
updateMotionButton();
if (!reducedMotion.matches) playBackground();

const fullscreenBtn = element('fullscreenBtn');
const feedback = element('feedback');
let feedbackTimeout;
fullscreenBtn.hidden = !document.fullscreenEnabled;
fullscreenBtn.addEventListener('click', async () => {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
    } catch {
        feedback.textContent = '暂时无法切换全屏，请使用浏览器的全屏功能。';
        feedback.hidden = false;
        clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => { feedback.hidden = true; }, 4000);
    }
});
document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? '退出全屏' : '进入全屏';
    fullscreenBtn.setAttribute('aria-label', label);
    fullscreenBtn.title = label;
});

// 打开页面时仅在每日闭馆后或整届落幕后展示，不使用持久化标记跳过。
const farewellDialog = element('farewellDialog');
if (shouldShowFarewell() && typeof farewellDialog.showModal === 'function') {
    farewellDialog.showModal();
    farewellDialog.addEventListener('close', () => {
        element('countdown').focus({ preventScroll: true });
    });
}
