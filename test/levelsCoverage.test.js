import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelXPStatus, levelsBlocker } from '../src/dashboard/public/levelsStatus.js';

const channel = (id, extra = {}) => ({
    id,
    name: id,
    type: 'text',
    botCanPost: true,
    botCanView: true,
    afk: false,
    ...extra,
});
const settings = (extra = {}) => ({
    enabled: true,
    channelId: 'levels',
    blacklisted: { roleIds: [], channelIds: [] },
    ...extra,
});

test('each channel says whether it earns XP, and why not', () => {
    const draft = settings({ blacklisted: { roleIds: [], channelIds: ['spam'] } });
    assert.deepEqual(channelXPStatus(channel('general'), draft), { earns: true, reason: 'Messages' });
    assert.equal(channelXPStatus(channel('spam'), draft).reason, 'On the no-XP list');
    assert.equal(channelXPStatus(channel('afk', { type: 'voice', afk: true }), draft).reason, 'The AFK channel');
    assert.equal(channelXPStatus(channel('staff', { botCanView: false }), draft).reason, 'Ovx can’t see this channel');
    assert.equal(channelXPStatus(channel('lounge', { type: 'voice' }), draft).reason, 'Voice and its chat');
});

test('what stops XP everywhere is shown, most important first', () => {
    const channels = [channel('levels'), channel('locked', { botCanPost: false })];
    assert.equal(levelsBlocker(settings(), settings(), channels), null, 'all good');
    assert.match(
        levelsBlocker(settings({ enabled: false }), settings({ enabled: false }), channels).text,
        /Levels are off/
    );
    assert.match(levelsBlocker(settings({ channelId: null }), settings(), channels).text, /choose a level-up channel/);
    assert.match(levelsBlocker(settings({ channelId: 'gone' }), settings(), channels).text, /was deleted/);
    assert.match(
        levelsBlocker(settings({ channelId: 'locked' }), settings(), channels).text,
        /can’t post in #locked.*turn levels off/
    );
});

test('levels Ovx turned off by itself say why', () => {
    const channels = [channel('locked', { botCanPost: false })];
    const saved = settings({ enabled: false, channelId: 'locked' });
    assert.match(levelsBlocker(saved, saved, channels).text, /turns levels off by itself/);
});
