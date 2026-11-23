// 使用明确的北京时间，避免访问者所在时区改变活动时刻。
const EVENT_START = new Date('2026-07-10T00:00:00+08:00').getTime();
const timeFields = ['days', 'hours', 'minutes', 'seconds'].map(id => document.getElementById(id));
const countdownTitle = document.getElementById('countdownTitle');
const eventStatus = document.getElementById('eventStatus');
const countdownNote = document.getElementById('countdownNote');

function updateCountdown(now = Date.now()) {
    const totalSeconds = Math.floor(Math.max(0, EVENT_START - now) / 1000);
    const values = [Math.floor(totalSeconds / 86400), Math.floor(totalSeconds / 3600) % 24, Math.floor(totalSeconds / 60) % 60, totalSeconds % 60];
    timeFields.forEach((field, index) => {
        const value = String(values[index]).padStart(index === 0 ? 3 : 2, '0');
        if (field.textContent !== value) field.textContent = value;
    });
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
