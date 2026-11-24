// 集成检查：需可用的 Playwright 与 Edge；先在项目目录启动本地 HTTP 服务。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin = process.env.BW_TEST_URL || 'http://127.0.0.1:8080';

async function assertFits(page, label) {
    await page.waitForFunction(() => [...document.querySelectorAll('.time-value')].every(field => {
        const range = document.createRange();
        range.selectNodeContents(field);
        return range.getBoundingClientRect().width <= field.getBoundingClientRect().width + 0.5;
    }), null, { timeout: 3000 });
    const sizes = await page.locator('.time-value').evaluateAll(fields => fields.map(field => {
        const range = document.createRange();
        range.selectNodeContents(field);
        return { text: field.textContent, textWidth: range.getBoundingClientRect().width, cellWidth: field.getBoundingClientRect().width };
    }));
    for (const size of sizes) assert.ok(size.textWidth <= size.cellWidth + 0.5, `${label}: ${JSON.stringify(size)}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: 页面横向溢出`);
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const fontMode of ['loaded', 'delayed', 'failed']) {
            const context = await browser.newContext({ isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 360, height: 850 }, reducedMotion: 'reduce' });
            const page = await context.newPage();
            // 固定测试值，避免一秒刷新把未来日期恢复为真实当前日期。
            await page.addInitScript(() => { window.setInterval = () => 0; });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            if (fontMode === 'failed') await page.route('**/fonts/*.woff2', route => route.abort());
            if (fontMode === 'delayed') await page.route('**/fonts/*.woff2', async route => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await route.continue();
            });
            await page.goto(`${origin}/?year=2018`, { waitUntil: 'domcontentloaded' });
            await page.locator('#farewellDialog button').click();
            await assertFits(page, `${fontMode}: 初次加载`);
            await page.evaluate(() => document.fonts.ready);
            if (fontMode !== 'failed') {
                for (const family of ['BW Numbers', 'BW Sans']) assert.equal(await page.evaluate(family => [...document.fonts].find(font => font.family === family)?.status, family), 'loaded');
            }
            // 最坏情况下回退至手机常见的宽数字字体，检查字体度量变化后的布局。
            if (fontMode === 'failed') await page.addStyleTag({ content: '.time-value { font-family: Arial, sans-serif !important; }' });
            for (const width of [320, 360, 390, 430, 700, 768, 1024, 1440]) {
                await page.setViewportSize({ width, height: 850 });
                await assertFits(page, `${fontMode}: ${width}px`);
                // 覆盖长期正计时的五位、七位天数；保留完整数值。
                for (const year of [2050, 9999]) {
                    await page.evaluate(year => updateCountdown(Date.parse(`${year}-01-01T00:00:00+08:00`)), year);
                    await assertFits(page, `${fontMode}: ${width}px / ${year}`);
                    assert.ok((await page.locator('#days').textContent()).length >= (year === 2050 ? 5 : 7));
                }
            }
            assert.deepEqual(errors, []);
            await context.close();
        }
        console.log('字体正常、延迟和失败回退；8 种宽度；四至七位天数均无溢出。');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
