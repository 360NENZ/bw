// 集成检查：记录起点前、未来时间待定、参数错误的页面表现。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.BW_TEST_URL || 'http://127.0.0.1:8080';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ reducedMotion: 'reduce' });
        await page.clock.setFixedTime(new Date('2026-11-24T12:00:00+08:00'));
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        for (const [year, state] of [['0000', 'before-records'], ['2017', 'before-records'], ['2027', 'schedule-pending'], ['2030', 'schedule-pending'], ['abc', 'invalid-year']]) {
            await page.goto(`${origin}/?year=${year}&showHours=1&test=keep&station=old#old`);
            assert.equal(await page.locator('#countdown').getAttribute('data-phase'), state);
            assert.equal(await page.locator('#countdownPanel').isVisible(), false);
            assert.equal(await page.locator('#eventDate').isVisible(), false);
            assert.equal(await page.locator('#eventLocation').isVisible(), false);
            assert.equal(await page.locator('#openingHours').isVisible(), false);
            assert.equal(await page.locator('#farewellDialog').isVisible(), false);
            assert.equal(await page.locator('#motionBtn').isVisible(), false);
            assert.equal(await page.locator('#backgroundVideo').getAttribute('src'), null);
            assert.equal(await page.locator('#backgroundPoster').getAttribute('src'), null);
            const text = await page.locator('#unavailablePanel').textContent();
            assert.ok(!text.includes('未收录'));
            assert.equal(await page.locator('#pendingOfficialLink').isVisible(), state === 'schedule-pending');
            if (state === 'schedule-pending') {
                assert.match(text, /时间待定/);
                assert.ok((await page.title()).includes('时间待定'));
                assert.ok((await page.locator('#yearLinks [aria-current="page"]').textContent()).includes(year));
                assert.match(await page.locator('#yearLinks [aria-current="page"]').textContent(), /待定/);
            }
            if (state === 'before-records') {
                assert.match(text, /2018/);
                const link = new URL(await page.locator('#returnLink').getAttribute('href'));
                assert.equal(link.searchParams.get('year'), '2018');
                assert.equal(link.searchParams.get('showHours'), '1');
                assert.equal(link.searchParams.get('test'), 'keep');
                assert.equal(link.searchParams.has('station'), false);
                assert.equal(link.hash, '');
            }
            for (const width of [320, 390, 768, 1440]) {
                await page.setViewportSize({ width, height: 850 });
                await page.evaluate(() => document.fonts.ready);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            }
        }
        await page.goto(`${origin}/?year=2017&showHours=1`);
        await page.locator('#returnLink').click();
        assert.equal(await page.locator('#eventYear').textContent(), '2018');
        assert.equal(await page.locator('#countdownPanel').isVisible(), true);
        assert.deepEqual(errors, []);
        console.log('记录起点前提示、未来待定文案与菜单、隐藏日期/计时/寄语/视频、参数保留和四种宽度通过');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
