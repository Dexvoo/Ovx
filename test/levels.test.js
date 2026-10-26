import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExpForLevel, LevelForExp, MessageXP, VoiceXP } from '../src/features/levels/utils/levels.js';

test('ExpForLevel follows 50n² + 25n and is 0 at or below level 0', () => {
    assert.equal(ExpForLevel(0), 0);
    assert.equal(ExpForLevel(-3), 0);
    assert.equal(ExpForLevel(1), 75);
    assert.equal(ExpForLevel(10), 5250);
});

test('LevelForExp returns [level, xpIntoLevel, xpForNextLevel]', () => {
    assert.deepEqual(LevelForExp(0), [0, 0, 75]);
    assert.deepEqual(LevelForExp(74), [0, 74, 75]);
    assert.deepEqual(LevelForExp(75), [1, 0, 175]);
    assert.deepEqual(LevelForExp(ExpForLevel(10) + 1), [10, 1, ExpForLevel(11) - ExpForLevel(10)]);
});

test('LevelForExp is the inverse of ExpForLevel', () => {
    for (let level = 0; level <= 200; level++) {
        assert.equal(LevelForExp(ExpForLevel(level))[0], level);
        if (level > 0) assert.equal(LevelForExp(ExpForLevel(level) - 1)[0], level - 1);
    }
});

test('MessageXP stays within 15–100', () => {
    for (let i = 0; i < 1000; i++) {
        const xp = MessageXP();
        assert.ok(Number.isInteger(xp) && xp >= 15 && xp <= 100, `got ${xp}`);
    }
});

test('VoiceXP for one minute stays within 5–13', () => {
    for (let i = 0; i < 1000; i++) {
        const xp = VoiceXP(1);
        assert.ok(Number.isInteger(xp) && xp >= 5 && xp <= 13, `got ${xp}`);
    }
});
