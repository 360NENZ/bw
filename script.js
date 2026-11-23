// 使用明确的北京时间，避免访问者所在时区改变活动时刻。
const EVENT_START = new Date('2026-07-10T08:00:00+08:00').getTime();
const EVENT_END = new Date('2026-07-12T18:00:00+08:00').getTime();
const OPENING_HOUR = 8;
const CLOSING_HOUR = 18;
const timeFields = ['days', 'hours', 'minutes', 'seconds'].map(id => document.getElementById(id));
const countdownTitle = document.getElementById('countdownTitle');
const eventStatus = document.getElementById('eventStatus');
const countdownNote = document.getElementById('countdownNote');
const showOpeningHours = new URLSearchParams(location.search).get('showHours') === '1';
document.getElementById('openingHours').hidden = !showOpeningHours;
let lastState;

function shouldShowFarewell(now = Date.now()) {
    if (now < EVENT_START) return false;
    if (now >= EVENT_END) return true;
    const beijingHour = new Date(now + 8 * 3600000).getUTCHours();
    return beijingHour >= CLOSING_HOUR || beijingHour < OPENING_HOUR;
}

function updateCountdown(now = Date.now()) {
    const phase = now < EVENT_START ? 'upcoming' : now < EVENT_END ? 'ongoing' : 'ended';
    const duration = phase === 'upcoming' ? EVENT_START - now : now - (phase === 'ongoing' ? EVENT_START : EVENT_END);
    const totalSeconds = Math.floor(Math.max(0, duration) / 1000);
    const values = [Math.floor(totalSeconds / 86400), Math.floor(totalSeconds / 3600) % 24, Math.floor(totalSeconds / 60) % 60, totalSeconds % 60];
    timeFields.forEach((field, index) => {
        const value = String(values[index]).padStart(index === 0 ? 3 : 2, '0');
        if (field.textContent !== value) field.textContent = value;
    });
    const beijingHour = new Date(now + 8 * 3600000).getUTCHours();
    const openingStatus = beijingHour < OPENING_HOUR ? '今日尚未开馆' : beijingHour < CLOSING_HOUR ? '现场开放中' : '今日已闭馆';
    const state = phase === 'ongoing' ? `${phase}:${openingStatus}` : phase;
    if (state !== lastState) {
        const copy = {
            upcoming: ['距 BW 2026 开场还有', '准备启航', '下一站，与你在现场相见。'],
            ongoing: ['BW 2026 已开场', openingStatus, beijingHour >= OPENING_HOUR && beijingHour < CLOSING_HOUR ? '相遇正在发生，尽情享受这场夏日的梦。' : `${showOpeningHours ? '每日 08:00–18:00 开放，' : ''}期待与你在现场相见。`],
            ended: ['距 BW 2026 落幕已经', '期待再会', '旅途虽已到站，热爱仍在继续。']
        }[phase];
        countdownTitle.textContent = copy[0];
        eventStatus.textContent = copy[1];
        countdownNote.textContent = copy[2];
        document.getElementById('countdown').dataset.phase = phase;
        lastState = state;
    }
}
updateCountdown();
setInterval(() => updateCountdown(), 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });

const video = document.getElementById('backgroundVideo');
const motionBtn = document.getElementById('motionBtn');
const motionLabel = document.getElementById('motionLabel');
const motionIcon = document.getElementById('motionIcon');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let videoFailed = false;
let userPaused = false;

function updateMotionButton() {
    const playing = !video.paused;
    motionLabel.textContent = playing ? '暂停背景' : '播放背景';
    motionBtn.title = motionLabel.textContent;
    motionIcon.setAttribute('d', playing ? 'M9 5v14M15 5v14' : 'm8 5 11 7-11 7Z');
}
function playBackground() {
    if (videoFailed) return;
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    video.play().catch(() => {
        // 自动播放受限时保留海报，允许用户主动播放。
        updateMotionButton();
    });
}
video.addEventListener('playing', () => { video.classList.add('is-playing'); updateMotionButton(); });
video.addEventListener('pause', updateMotionButton);
video.addEventListener('error', () => {
    videoFailed = true;
    video.classList.remove('is-playing');
    motionBtn.hidden = true;
});
motionBtn.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) video.pause();
    else playBackground();
});
reducedMotion.addEventListener('change', event => {
    if (event.matches) video.pause();
    else if (!userPaused && !document.hidden) playBackground();
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else if (!userPaused && !reducedMotion.matches) playBackground();
});
motionBtn.hidden = false;
updateMotionButton();
if (!reducedMotion.matches) playBackground();

const fullscreenBtn = document.getElementById('fullscreenBtn');
const feedback = document.getElementById('feedback');
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
const farewellDialog = document.getElementById('farewellDialog');
if (shouldShowFarewell() && typeof farewellDialog.showModal === 'function') {
    farewellDialog.showModal();
    farewellDialog.addEventListener('close', () => {
        document.getElementById('countdown').focus({ preventScroll: true });
    });
}
