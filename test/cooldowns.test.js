import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CooldownManager } from '../src/shared/cache/cooldowns.js';

test('cooldowns expire after their duration', () => {
    mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    try {
        const cooldowns = new CooldownManager();
        cooldowns.add('command', 'user', 5, 'ping');

        assert.equal(cooldowns.getRemaining('command', 'user', 'ping'), 1_005_000);
        assert.ok(cooldowns.has('command', 'user', 'ping'));

        mock.timers.tick(4_999);
        assert.ok(cooldowns.has('command', 'user', 'ping'));

        mock.timers.tick(1);
        assert.equal(cooldowns.getRemaining('command', 'user', 'ping'), null);
        assert.equal(cooldowns.cooldowns.size, 0, 'expired entry is removed on read');
    } finally {
        mock.timers.reset();
    }
});

test('cooldowns are scoped by type, user and identifier', () => {
    const cooldowns = new CooldownManager();
    cooldowns.add('command', 'user', 60, 'ping');

    assert.ok(!cooldowns.has('command', 'user', 'level'));
    assert.ok(!cooldowns.has('command', 'other', 'ping'));
    assert.ok(!cooldowns.has('message', 'user', 'ping'));
});

test('the sweep interval removes expired cooldowns without them being read', () => {
    mock.timers.enable({ apis: ['Date', 'setInterval'], now: 0 });
    try {
        const cooldowns = new CooldownManager(60_000);
        cooldowns.add('message', 'a', 30, 'guild');
        cooldowns.add('message', 'b', 120, 'guild');

        mock.timers.tick(60_000);
        assert.deepEqual([...cooldowns.cooldowns.keys()], ['message:guild:b'], 'expired entry swept, active one kept');
    } finally {
        mock.timers.reset();
    }
});

test('remove, clear and cleanup', () => {
    mock.timers.enable({ apis: ['Date'], now: 0 });
    try {
        const cooldowns = new CooldownManager();
        cooldowns.add('command', 'a', 1);
        cooldowns.add('command', 'b', 100);

        cooldowns.remove('command', 'b');
        assert.ok(!cooldowns.has('command', 'b'));

        cooldowns.add('command', 'b', 100);
        mock.timers.tick(2_000);
        cooldowns.cleanup();
        assert.deepEqual([...cooldowns.cooldowns.keys()], ['command::b'], 'cleanup removes only expired entries');

        cooldowns.clear();
        assert.equal(cooldowns.cooldowns.size, 0);
    } finally {
        mock.timers.reset();
    }
});
