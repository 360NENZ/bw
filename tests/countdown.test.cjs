const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadClock() {
    const elements = new Map();
    const getElementById = id => {
        if (!elements.has(id)) elements.set(id, { textContent: '', dataset: {} });
        return elements.get(id);
    };
    const context = vm.createContext({ document: { getElementById }, Date });
    const source = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
    vm.runInContext(source.split('updateCountdown();')[0], context);
    return now => {
        vm.runInContext(`updateCountdown(${new Date(now).getTime()})`, context);
        return {
            phase: elements.get('countdown').dataset.phase,
            title: elements.get('countdownTitle').textContent,
            status: elements.get('eventStatus').textContent,
            values: ['days', 'hours', 'minutes', 'seconds'].map(id => elements.get(id).textContent)
        };
    };
}

test('7 月 10 日 08:00 前一秒倒计时，开馆时切换到活动期', () => {
    const clock = loadClock();
    assert.deepEqual(clock('2026-07-10T07:59:59+08:00'), {phase:'upcoming', title:'距 BW 2026 开场还有', status:'准备启航', values:['000','00','00','01']});
    assert.deepEqual(clock('2026-07-10T08:00:00+08:00'), {phase:'ongoing', title:'BW 2026 已开场', status:'现场开放中', values:['000','00','00','00']});
});
test('7 月 12 日 18:00 落幕后从结束时刻正计时', () => {
    const clock = loadClock();
    assert.deepEqual(clock('2026-07-12T17:59:59+08:00'), {phase:'ongoing', title:'BW 2026 已开场', status:'现场开放中', values:['002','09','59','59']});
    assert.deepEqual(clock('2026-07-12T18:00:00+08:00'), {phase:'ended', title:'距 BW 2026 落幕已经', status:'期待再会', values:['000','00','00','00']});
    assert.deepEqual(clock('2026-07-13T19:02:03+08:00').values, ['001','01','02','03']);
});
test('每日开闭馆状态切换，夜间不重置整届计时', () => {
    const clock = loadClock();
    assert.equal(clock('2026-07-10T18:00:00+08:00').status, '今日已闭馆');
    assert.equal(clock('2026-07-11T07:59:59+08:00').status, '今日尚未开馆');
    assert.equal(clock('2026-07-11T08:00:00+08:00').status, '现场开放中');
    assert.deepEqual(clock('2026-07-11T08:00:00+08:00').values, ['001','00','00','00']);
});
test('时间基准不受访问者时区影响，长期正计时天数不截断', () => {
    const clock = loadClock();
    assert.deepEqual(clock('2026-07-10T00:00:00Z'), clock('2026-07-10T08:00:00+08:00'));
    assert.deepEqual(clock('2030-01-01T00:00:00+08:00').values, ['1268','06','00','00']);
});
