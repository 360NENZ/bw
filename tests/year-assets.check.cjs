// 集成检查：逐年图标、竖屏原图、旋转时的播放状态。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { events, icons, stations } = require('../events.js');
const origin = process.env.BW_TEST_URL || 'http://127.0.0.1:8080';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [], videoRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.mp4')) videoRequests.push(request.url()); });
        await page.clock.setFixedTime(new Date('2018-01-01T00:00:00+08:00'));
        for (const year of [...Object.keys(events), '2017', 'abc']) {
            await page.goto(`${origin}/?year=${year}`);
            const expected = icons[year] || { icon: 'assets/favicon.ico', touchIcon: 'assets/bw-icon.png' };
            for (const [id, key] of [['siteIcon', 'icon'], ['touchIcon', 'touchIcon']]) {
                const href = await page.locator(`#${id}`).getAttribute('href');
                assert.ok(href.startsWith(expected[key]), `${year}: ${href}`);
                const response = await page.request.get(new URL(href, page.url()).href);
                assert.equal(response.status(), 200);
                assert.ok((await response.body()).length > 100);
                assert.equal(await page.evaluate(async href => {
                    const img = new Image(); img.src = href; await img.decode();
                    return img.naturalWidth > 0 && img.naturalHeight > 0;
                }, href), true);
            }
        }
        console.log('逐年 favicon、主屏幕图标、未举办/无效年份回退与素材可读性通过');
        for (const event of Object.values(stations[2019])) {
            videoRequests.length = 0;
            await page.goto(`${origin}/?year=2019&station=${event.station}`);
            await page.waitForFunction(() => document.getElementById('backgroundPoster').naturalWidth > 0);
            assert.equal(await page.locator('html').getAttribute('data-background-mode'), 'portrait');
            assert.equal(await page.locator('html').getAttribute('data-poster-orientation'), 'portrait');
            assert.ok((await page.locator('#backgroundPoster').getAttribute('src')).startsWith(event.portraitPoster));
            assert.equal(await page.locator('#backgroundPoster').evaluate(img => getComputedStyle(img).objectFit), 'contain');
            assert.equal(await page.locator('#backgroundVideo').getAttribute('src'), null);
            assert.equal(await page.locator('#motionBtn').isVisible(), false);
            assert.deepEqual(videoRequests, []);
            console.log(`2019 ${event.stationName}: 竖屏完整原图、不加载横屏视频通过`);
        }
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
        assert.equal(await page.locator('#motionBtn').isVisible(), true);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => document.getElementById('backgroundVideo').paused);
        assert.equal(await page.locator('#backgroundVideo').isVisible(), false);
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForFunction(() => !document.getElementById('backgroundVideo').paused);
        await page.locator('#motionBtn').click();
        const pausedAt = await page.locator('#backgroundVideo').evaluate(video => video.currentTime);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#backgroundVideo').evaluate((video, time) => video.paused && video.currentTime === time, pausedAt), true);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${origin}/?year=2019`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.setViewportSize({ width: 1280, height: 720 });
        assert.equal(await page.locator('#backgroundVideo').getAttribute('src'), null);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto(`${origin}/?year=2021`);
        await page.waitForFunction(() => document.getElementById('backgroundVideo').ended);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.setViewportSize({ width: 1280, height: 720 });
        assert.equal(await page.locator('#backgroundVideo').evaluate(video => video.ended), true);
        assert.equal(await page.locator('html').getAttribute('data-background-mode'), 'default');
        assert.deepEqual(errors, []);
        console.log('横竖屏实时切换、恢复播放、保留手动暂停/减少动态效果/播放结束状态通过');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
