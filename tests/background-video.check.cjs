// 集成检查：需要 Playwright、Edge 和本地 HTTP 服务。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { events, stations } = require('../events.js');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const origin = process.env.BW_TEST_URL || 'http://127.0.0.1:8080';

// 在解码层比较真正首尾帧，避免浏览器 seeked 时画面尚未合成造成假阳性。
const loopFile = path.join(__dirname, '../assets/bw-2020-banner.mp4');
const frame = time => execFileSync('ffmpeg', ['-v', 'error', '-ss', String(time), '-i', loopFile,
    '-frames:v', '1', '-vf', 'scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
const rms = (a, b) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0) / a.length);
const first = frame(0), next = frame(.04), last = frame(9.76);
assert.equal(first.length, 320 * 180 * 3);
assert.equal(last.length, first.length);
const boundaryRms = rms(first, last), adjacentRms = rms(first, next);
assert.ok(boundaryRms < adjacentRms * 1.2, `循环接缝 ${boundaryRms} 超过正常帧间运动 ${adjacentRms}`);
console.log(`2020 上海首尾 RMS ${boundaryRms.toFixed(2)}，正常相邻帧 ${adjacentRms.toFixed(2)}`);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        // 缓存页面残留的 loop 属性也必须服从年份配置。
        await page.route(url => url.pathname === '/', async route => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()).replace(
                '<video id="backgroundVideo" class="background-video"',
                '<video id="backgroundVideo" class="background-video" loop'
            ) });
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.setFixedTime(new Date('2018-01-01T00:00:00+08:00'));
        const state = () => page.locator('#backgroundVideo').evaluate(video => ({
            time: video.currentTime, duration: video.duration, ended: video.ended,
            paused: video.paused, loop: video.loop,
            visible: video.classList.contains('is-playing') && getComputedStyle(video).opacity === '1'
        }));
        async function changeVisibility(hidden) {
            await page.evaluate(hidden => {
                Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
                document.dispatchEvent(new Event('visibilitychange'));
            }, hidden);
        }
        const videos = [...new Set([...Object.values(events), ...Object.values(stations).flatMap(Object.values)])].filter(event => event.video);
        for (const event of videos) {
            const query = `year=${event.year}${event.station ? `&station=${event.station}` : ''}`;
            await page.goto(`${origin}/?${query}`);
            await page.waitForFunction(() => {
                const video = document.getElementById('backgroundVideo');
                return !video.paused && video.readyState >= 2 && getComputedStyle(video).opacity === '1';
            });
            assert.equal((await state()).loop, event.loop, query);
            await page.locator('#backgroundVideo').evaluate(video => { video.currentTime = video.duration - .25; });
            if (event.loop) {
                await page.waitForFunction(() => {
                    const video = document.getElementById('backgroundVideo');
                    return video.currentTime < video.duration / 2 && !video.paused;
                });
                assert.equal((await state()).ended, false);
                assert.equal((await state()).visible, true);
                assert.equal(await page.locator('#motionLabel').textContent(), '暂停背景');
                if (event.year === 2020 && event.station === 'shanghai') {
                    assert.ok(Math.abs((await state()).duration - 9.8) < .05);
                }
            } else {
                await page.waitForFunction(() => document.getElementById('backgroundVideo').ended);
                const ended = await state();
                assert.equal(ended.paused, true);
                assert.equal(ended.visible, true);
                assert.ok(Math.abs(ended.duration - 2) < .05);
                assert.equal(await page.locator('#motionLabel').textContent(), '重播背景');
                const pixels = await page.locator('#backgroundVideo').evaluate(async video => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1920; canvas.height = 1080;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(video, 0, 0, 1920, 1080);
                    const frame = ctx.getImageData(0, 0, 1920, 1080).data;
                    const poster = new Image(); poster.src = video.poster; await poster.decode();
                    ctx.drawImage(poster, 0, 0, 1920, 1080);
                    const image = ctx.getImageData(0, 0, 1920, 1080).data;
                    let square = 0, sum = 0, count = 0;
                    for (let i = 0; i < frame.length; i += 4) for (let c = 0; c < 3; c++) {
                        square += (frame[i + c] - image[i + c]) ** 2; sum += frame[i + c]; count++;
                    }
                    return { rms: Math.sqrt(square / count), mean: sum / count };
                });
                assert.ok(pixels.rms < 12 && pixels.mean > 60, JSON.stringify(pixels));
                await changeVisibility(true);
                await changeVisibility(false);
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                await page.waitForTimeout(250);
                assert.equal((await state()).ended, true);
                await page.locator('#motionBtn').click();
                await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused && document.getElementById('backgroundVideo').currentTime < 1);
            }
            await page.locator('#motionBtn').click();
            const pausedAt = (await state()).time;
            assert.equal((await state()).paused, true);
            await changeVisibility(true);
            await changeVisibility(false);
            await page.waitForTimeout(150);
            assert.equal((await state()).time, pausedAt);
            await page.locator('#motionBtn').click();
            await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
            await changeVisibility(true);
            assert.equal((await state()).paused, true);
            await changeVisibility(false);
            await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
            console.log(`${query}: ${event.loop ? '持续循环' : '结束停留与手动重播'}、暂停继续和后台切换通过`);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${origin}/?year=2021`);
        assert.equal(await page.locator('#backgroundVideo').getAttribute('src'), null);
        await page.locator('#motionBtn').click();
        await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
        assert.deepEqual(errors, []);
        console.log('减少动态效果：默认海报与手动播放通过');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
