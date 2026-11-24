// 集成检查：需要 Playwright、Edge 和本地 HTTP 服务。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.BW_TEST_URL || 'http://127.0.0.1:8080';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        // 模拟缓存页面仍带有 loop 属性，新脚本必须将其关闭。
        await page.route(url => url.pathname === '/', async route => {
            const response = await route.fetch();
            const html = (await response.text()).replace(
                '<video id="backgroundVideo" class="background-video"',
                '<video id="backgroundVideo" class="background-video" loop'
            );
            await route.fulfill({ response, body: html });
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.setFixedTime(new Date('2018-01-01T00:00:00+08:00'));
        const state = () => page.locator('#backgroundVideo').evaluate(video => ({
            time: video.currentTime, duration: video.duration, ended: video.ended,
            paused: video.paused, loop: video.loop,
            visible: video.classList.contains('is-playing') && getComputedStyle(video).opacity === '1'
        }));
        async function checkStopped(year) {
            await page.waitForFunction(year => {
                const video = document.getElementById('backgroundVideo');
                return getComputedStyle(video).opacity === '1';
            }, year);
            const current = await state();
            assert.equal(current.ended, true);
            assert.equal(current.paused, true);
            assert.equal(current.visible, true);
            assert.equal(current.time, current.duration);
            assert.equal(await page.locator('#motionLabel').textContent(), '重播背景');
        }
        async function changeVisibility(hidden) {
            await page.evaluate(hidden => {
                Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
                document.dispatchEvent(new Event('visibilitychange'));
            }, hidden);
        }

        for (const year of [2021, 2019, 2020, 2026]) {
            await page.goto(`${origin}/?year=${year}`);
            await page.waitForFunction(() => {
                const video = document.getElementById('backgroundVideo');
                return !video.paused && video.readyState >= 2;
            });
            assert.equal((await state()).loop, false);
            if (![2020, 2021].includes(year)) {
                await page.locator('#backgroundVideo').evaluate(video => { video.currentTime = video.duration - 0.25; });
            }
            await page.waitForFunction(() => document.getElementById('backgroundVideo').ended);
            await checkStopped(year);
            if ([2020, 2021].includes(year)) {
                const pixels = await page.locator('#backgroundVideo').evaluate(async video => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1920; canvas.height = 1080;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(video, 0, 0, 1920, 1080);
                    const frame = ctx.getImageData(0, 0, 1920, 1080).data;
                    const poster = new Image(); poster.src = video.poster; await poster.decode();
                    ctx.drawImage(poster, 0, 0, 1920, 1080);
                    const image = ctx.getImageData(0, 0, 1920, 1080).data;
                    let squared = 0, sum = 0, sumSquared = 0, count = 0;
                    for (let i = 0; i < frame.length; i += 4) {
                        const luma = .2126 * frame[i] + .7152 * frame[i + 1] + .0722 * frame[i + 2];
                        sum += luma; sumSquared += luma * luma; count++;
                        for (let c = 0; c < 3; c++) squared += (frame[i + c] - image[i + c]) ** 2;
                    }
                    return { rms: Math.sqrt(squared / (count * 3)), mean: sum / count,
                        contrast: Math.sqrt(sumSquared / count - (sum / count) ** 2) };
                });
                assert.ok(pixels.rms < 12, `${year}: 海报应与结束画面相同 ${JSON.stringify(pixels)}`);
                assert.ok(pixels.mean > 60 && pixels.contrast > 35, `${year}: 片尾不应变暗或泛白 ${JSON.stringify(pixels)}`);
                const expectedDuration = year === 2021 ? 2 : 10.4;
                assert.ok(Math.abs((await state()).duration - expectedDuration) < .05);
            }
            await changeVisibility(true);
            await changeVisibility(false);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.waitForTimeout(400);
            await checkStopped(year);

            await page.locator('#motionBtn').click();
            await page.waitForFunction(() => {
                const video = document.getElementById('backgroundVideo');
                return !video.paused && !video.ended && video.currentTime < 1
                    && document.getElementById('motionLabel').textContent === '暂停背景';
            });
            assert.equal(await page.locator('#motionLabel').textContent(), '暂停背景');
            await page.locator('#motionBtn').click();
            const pausedAt = (await state()).time;
            await changeVisibility(true);
            await changeVisibility(false);
            await page.waitForTimeout(200);
            assert.equal((await state()).paused, true);
            assert.equal((await state()).time, pausedAt);
            await page.locator('#motionBtn').click();
            await page.waitForFunction(time => {
                const video = document.getElementById('backgroundVideo');
                return !video.paused && video.currentTime > time;
            }, pausedAt);
            await changeVisibility(true);
            assert.equal((await state()).paused, true);
            await changeVisibility(false);
            await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
            console.log(`${year}: 结束停留、切回与动态设置不重播、手动重播、暂停继续通过`);
        }

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${origin}/?year=2021`);
        assert.equal(await page.locator('#backgroundVideo').getAttribute('src'), null);
        await page.locator('#motionBtn').click();
        await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
        console.log('减少动态效果：默认海报与手动播放通过');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });



