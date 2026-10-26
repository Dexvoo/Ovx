import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { UserLevels } from '../src/features/levels/models/userLevels.js';
import User_Levels_Cache from '../src/features/levels/cache/userLevels.cache.js';

let writes;
let failNext;

beforeEach(() => {
    writes = [];
    failNext = false;
    User_Levels_Cache.cache.flushAll();
    User_Levels_Cache.dirty.clear();

    UserLevels.findOne = () => ({ lean: async () => null });
    UserLevels.bulkWrite = async (operations) => {
        if (failNext) {
            failNext = false;
            throw new Error('simulated failure');
        }
        writes.push(...operations);
    };
});

const writtenUsers = () => writes.map((op) => `${op.updateOne.filter.guildId}:${op.updateOne.filter.userId}`).sort();

test('reading a user does not mark them for saving', async () => {
    await User_Levels_Cache.get('g1', 'u1');
    await User_Levels_Cache.flush();
    assert.equal(writes.length, 0);
});

test('flush(guildId) only saves that guild and leaves the rest queued', async () => {
    await User_Levels_Cache.incrementCommands('g1', 'u1');
    await User_Levels_Cache.incrementCommands('g2', 'u2');

    await User_Levels_Cache.flush('g1');
    assert.deepEqual(writtenUsers(), ['g1:u1']);
    assert.ok(User_Levels_Cache.dirty.has('g2:u2'), 'other guild still queued');

    await User_Levels_Cache.flush();
    assert.deepEqual(writtenUsers(), ['g1:u1', 'g2:u2']);
});

test('saved data excludes _id and __v, and keeps the user ids in the filter', async () => {
    await User_Levels_Cache.incrementCommands('g1', 'u1');
    await User_Levels_Cache.flush();

    const { filter, update } = writes[0].updateOne;
    assert.deepEqual(filter, { guildId: 'g1', userId: 'u1' });
    assert.equal(update.$set.totalCommands, 1);
    assert.ok(!('_id' in update.$set) && !('__v' in update.$set) && !('guildId' in update.$set));
});

test('a failed save re-queues users for the next flush', async () => {
    await User_Levels_Cache.incrementCommands('g1', 'u1');

    failNext = true;
    await User_Levels_Cache.flush();
    assert.ok(User_Levels_Cache.dirty.has('g1:u1'));

    await User_Levels_Cache.flush();
    assert.deepEqual(writtenUsers(), ['g1:u1']);
});

test('flushes requested at the same time run in order and never double-write', async () => {
    await User_Levels_Cache.incrementCommands('g1', 'u1');
    await User_Levels_Cache.incrementCommands('g2', 'u2');

    await Promise.all([User_Levels_Cache.flush(), User_Levels_Cache.flush('g1'), User_Levels_Cache.flush()]);
    assert.deepEqual(writtenUsers(), ['g1:u1', 'g2:u2']);
});

test('unsaved users never expire from the cache, saved ones get the normal TTL back', async () => {
    await User_Levels_Cache.incrementCommands('g1', 'u1');
    assert.equal(User_Levels_Cache.cache.getTtl('g1:u1'), 0, 'no expiry while unsaved');

    await User_Levels_Cache.flush();
    assert.ok(User_Levels_Cache.cache.getTtl('g1:u1') > Date.now(), 'TTL restored after save');
});

test('a database error while loading returns null instead of a blank record', async () => {
    UserLevels.findOne = () => ({
        lean: async () => {
            throw new Error('db down');
        },
    });
    assert.equal(await User_Levels_Cache.get('g1', 'u1'), null);
    assert.equal(await User_Levels_Cache.incrementCommands('g1', 'u1'), null);
    assert.equal(User_Levels_Cache.dirty.size, 0);
});
