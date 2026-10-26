import { test } from 'node:test';
import assert from 'node:assert/strict';
import User_Levels_Cache from '../src/features/levels/cache/userLevels.cache.js';
import { ExpForLevel } from '../src/features/levels/utils/levels.js';

const user = (level, xp) => ({ level, xp, lastLevelUpAt: null });

test('applyXP adds XP and levels up normally below the cap', () => {
    const data = user(0, 0);
    const result = User_Levels_Cache.applyXP(data, 80, 100);

    assert.deepEqual(result, { gained: 80, leveledUp: true });
    assert.equal(data.xp, 80);
    assert.equal(data.level, 1);
    assert.ok(data.lastLevelUpAt instanceof Date);
});

test('applyXP stops XP at exactly the max level requirement', () => {
    const data = user(4, ExpForLevel(5) - 10);
    const result = User_Levels_Cache.applyXP(data, 1000, 5);

    assert.deepEqual(result, { gained: 10, leveledUp: true });
    assert.equal(data.xp, ExpForLevel(5));
    assert.equal(data.level, 5);
});

test('applyXP gives nothing at the max level', () => {
    const data = user(5, ExpForLevel(5));
    assert.deepEqual(User_Levels_Cache.applyXP(data, 50, 5), { gained: 0, leveledUp: false });
    assert.equal(data.xp, ExpForLevel(5));
});

test('applyXP keeps users above a lowered max level where they are', () => {
    const data = user(20, ExpForLevel(20) + 5);
    assert.deepEqual(User_Levels_Cache.applyXP(data, 50, 10), { gained: 0, leveledUp: false });
    assert.equal(data.level, 20, 'not demoted');
});

test('applyXP never jumps past the max level in one big gain', () => {
    const data = user(0, 0);
    User_Levels_Cache.applyXP(data, 1_000_000, 3);
    assert.equal(data.level, 3);
    assert.equal(data.xp, ExpForLevel(3));
});

test('applyXP has no cap when maxLevel is missing', () => {
    const data = user(0, 0);
    User_Levels_Cache.applyXP(data, ExpForLevel(500), undefined);
    assert.equal(data.level, 500);
});
