// 集成检查：需要 Playwright、Edge 和本地 HTTP 服务。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { stations } = require('../events.js');
const origin = process.env.BW_TEST_URL || 'http://127.0.0.1:8080';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 360, height: 850 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.setFixedTime(new Date('2018-01-01T00:00:00+08:00'));
        for (const event of Object.values(stations).flatMap(Object.values)) {
            await page.goto(`${origin}/?year=${event.year}&station=${event.station}&showHours=1&test=keep#old`);
            await page.evaluate(() => document.fonts.ready);
            assert.equal(await page.locator('#venue').textContent(), event.venue);
            assert.equal(await page.locator('#startDate').getAttribute('datetime'), event.startDate);
            assert.equal(await page.locator('#endDate').getAttribute('datetime'), event.endDate);
            assert.equal(await page.locator('#stationPicker [aria-current="page"]').textContent(), event.stationName);
            assert.match(await page.locator('#countdownTitle').textContent(), new RegExp(event.stationName));
            assert.equal(await page.locator('#openingHours').isVisible(), true);
            assert.ok((await page.locator('#backgroundPoster').getAttribute('src')).startsWith(event.poster));
            assert.ok((await page.locator('#backgroundVideo').getAttribute('data-src')).startsWith(event.video));
            for (const href of await page.locator('#stationPicker a').evaluateAll(links => links.map(link => link.href))) {
                const url = new URL(href);
                assert.equal(url.searchParams.get('year'), String(event.year));
                assert.equal(url.searchParams.get('showHours'), '1');
                assert.equal(url.searchParams.get('test'), 'keep');
                assert.equal(url.hash, '');
            }
            for (const href of await page.locator('#yearLinks a').evaluateAll(links => links.map(link => link.href))) {
                assert.equal(new URL(href).searchParams.has('station'), false);
                assert.equal(new URL(href).searchParams.get('showHours'), '1');
            }
            for (const width of [320, 360, 390, 768, 1024, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
                for (const id of ['stationPicker', 'venue', 'countdownTitle', 'timerGrid']) {
                    const box = await page.locator(`#${id}`).boundingBox();
                    assert.ok(box.x >= 0 && box.x + box.width <= width + .5, `${event.year} ${event.station} ${width}: ${id}`);
                }
            }
            console.log(`${event.year} ${event.stationName}: 日期、场馆、素材、参数与六种宽度通过`);
        }
        await page.goto(`${origin}/?year=2019&showHours=1`);
        await page.getByRole('link', { name: '成都站', exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get('station'), 'chengdu');
        assert.equal(await page.locator('#endDate').getAttribute('datetime'), '2019-12-22');
        await page.locator('#yearPicker summary').click();
        await page.locator('#yearLinks a', { hasText: '2020' }).click();
        assert.equal(new URL(page.url()).searchParams.has('station'), false);
        assert.equal(await page.locator('#stationPicker [aria-current="page"]').textContent(), '上海站');
        await page.getByRole('link', { name: '广州站', exact: true }).click();
        assert.equal(await page.locator('#endDate').getAttribute('datetime'), '2020-12-27');
        for (const query of ['year=2019&station=unknown', 'year=2021&station=shanghai']) {
            await page.goto(`${origin}/?${query}&showHours=1`);
            assert.equal(await page.locator('#countdownPanel').isVisible(), false);
            assert.equal(await page.locator('#unavailablePanel').isVisible(), true);
            assert.equal(await page.locator('#openingHours').isVisible(), false);
            assert.equal(await page.locator('#backgroundVideo').getAttribute('src'), null);
        }
        await page.goto(`${origin}/?year=2020&station=guangzhou`);
        assert.equal(await page.locator('#openingHours').isVisible(), false);
        assert.deepEqual(errors, []);
        console.log('站点与年份实际切换、无效站点和默认隐藏时间提示通过');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
