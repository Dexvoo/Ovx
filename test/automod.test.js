import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    AutoModerationActionType,
    AutoModerationRuleTriggerType,
    DiscordAPIError,
    PermissionFlagsBits,
} from 'discord.js';
import { automodDefaults, raidDefaults, withAutomodDefaults } from '../src/features/automod/models/automodConfig.js';
import { validateAutomodSettings, describeAutomodChanges } from '../src/features/automod/utils/settings.js';
import { desiredRules, syncRules, ruleStatus } from '../src/features/automod/utils/rules.js';
import { onMemberJoin, resetRaidState } from '../src/features/automod/utils/raid.js';
import Automod_Config_Cache from '../src/features/automod/cache/automodConfig.cache.js';

const ALERTS = '500000000000000001';
const ROLE = '600000000000000001';
const context = /** @type {any} */ ({
    textChannelIds: new Set([ALERTS]),
    channelIds: new Set([ALERTS]),
    roles: new Map([[ROLE, { position: 1, managed: false }]]),
});

const settings = (overrides = {}) => ({
    automod: { ...automodDefaults(), alertChannelId: ALERTS, ...overrides },
    raid: raidDefaults(),
});

// ---------- Settings ----------

test('good settings are accepted, and lists are tidied', () => {
    const { settings: valid, errors } = validateAutomodSettings(
        settings({
            words: { enabled: true, keywords: [' Badword ', 'badword', '*scam*'], allowed: [], timeoutMinutes: 10 },
            links: { enabled: true, allowedSites: ['https://www.YouTube.com/watch', 'tenor.com'] },
        }),
        context
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(valid.automod.words.keywords, ['badword', '*scam*']);
    assert.deepEqual(valid.automod.links.allowedSites, ['youtube.com', 'tenor.com']);
});

test("Discord's limits and missing pieces are reported", () => {
    const { errors } = validateAutomodSettings(
        {
            automod: {
                ...settings().automod,
                alertChannelId: null,
                words: { enabled: true, keywords: ['x'.repeat(61)], allowed: [], timeoutMinutes: 0 },
                links: { enabled: true, allowedSites: ['not a site'] },
            },
            raid: { ...raidDefaults(), enabled: true },
        },
        context
    );
    for (const expected of [
        /at most 60 characters/,
        /not a website address/,
        /alert channel, so staff hear about raids/,
    ]) {
        assert.ok(
            errors.some((error) => expected.test(error)),
            `expected ${expected}`
        );
    }
    assert.ok(
        validateAutomodSettings(
            settings({ words: { enabled: true, keywords: [], allowed: [], timeoutMinutes: 0 } }),
            context
        ).errors.some((e) => /at least one blocked word/.test(e))
    );
});

test('the Web Logs say blocked words changed, without listing them', () => {
    const names = { channel: () => '#alerts', role: () => '@Staff' };
    const before = { automod: automodDefaults(), raid: raidDefaults() };
    const after = {
        automod: {
            ...automodDefaults(),
            words: { enabled: true, keywords: ['slur1', 'slur2'], allowed: [], timeoutMinutes: 0 },
        },
        raid: raidDefaults(),
    };
    const changes = describeAutomodChanges(before, after, names);
    assert.ok(changes.includes('Blocked words: off → on'));
    assert.ok(changes.includes('Blocked words list changed (0 → 2 words)'));
    assert.ok(!changes.join(' ').includes('slur1'));
});

test('old or partial saved settings get defaults for anything missing', () => {
    const config = withAutomodDefaults('g', { automod: { spam: { enabled: true } } });
    assert.equal(config.automod.spam.enabled, true);
    assert.equal(config.automod.mentions.limit, 5);
    assert.ok(config.automod.links.allowedSites.includes('tenor.com'));
    assert.equal(config.raid.joins, 10);
});

// ---------- Rules sent to Discord ----------

test('each filter becomes the right Discord AutoMod rule', () => {
    const rules = desiredRules({
        ...automodDefaults(),
        alertChannelId: ALERTS,
        blockMessage: 'Not here!',
        spam: { enabled: true },
        mentions: { enabled: true, limit: 4, raidProtection: true, timeoutMinutes: 15 },
        presets: { profanity: false, sexualContent: true, slurs: true },
        words: { enabled: false, keywords: [], allowed: ['scunthorpe'], timeoutMinutes: 0 },
        links: { enabled: true, allowedSites: ['youtube.com'] },
    });

    assert.equal(rules.words, null, 'switched-off filters have no rule');
    assert.equal(rules.spam.triggerType, AutoModerationRuleTriggerType.Spam);
    assert.deepEqual(
        rules.spam.actions.map((action) => action.type),
        [AutoModerationActionType.BlockMessage, AutoModerationActionType.SendAlertMessage],
        "spam can't time out (a Discord limit)"
    );
    assert.equal(rules.spam.actions[0].metadata.customMessage, 'Not here!');
    assert.deepEqual(rules.mentions.triggerMetadata, { mentionTotalLimit: 4, mentionRaidProtectionEnabled: true });
    assert.equal(rules.mentions.actions.at(-1).metadata.durationSeconds, 900);
    assert.deepEqual(rules.presets.triggerMetadata.presets, [2, 3]);
    assert.deepEqual(rules.presets.triggerMetadata.allowList, ['scunthorpe']);
    assert.ok(rules.links.triggerMetadata.regexPatterns.length > 0);
    assert.deepEqual(rules.links.triggerMetadata.allowList, ['*youtube.com*']);
});

/** A server's AutoMod rules in Discord. */
function fakeGuild({ canManage = true, existing = [], failOn = null } = {}) {
    const rules = new Map(existing.map((rule) => [rule.id, rule]));
    let next = 1;
    const calls = [];
    const makeRule = (id, data) => ({
        id,
        enabled: true,
        ...data,
        edit: async (changes) => {
            calls.push(['edit', id, changes]);
            Object.assign(rules.get(id), changes);
        },
        delete: async () => {
            calls.push(['delete', id]);
            rules.delete(id);
        },
    });
    for (const rule of existing) rules.set(rule.id, makeRule(rule.id, rule));
    const collection = () =>
        Object.assign(new Map(rules), { filter: (fn) => ({ size: [...rules.values()].filter(fn).length }) });
    const guild = {
        members: { me: { permissions: { has: (flag) => flag === PermissionFlagsBits.ManageGuild && canManage } } },
        autoModerationRules: {
            fetch: async () => collection(),
            create: async (data) => {
                if (failOn === data.name)
                    throw new DiscordAPIError(
                        { code: 30035, message: 'Maximum number of rules reached' },
                        30035,
                        400,
                        'POST',
                        '/',
                        {}
                    );
                const id = `new${next++}`;
                calls.push(['create', id, data]);
                rules.set(id, makeRule(id, data));
                return rules.get(id);
            },
        },
    };
    return { guild: /** @type {any} */ (guild), rules, calls };
}

test('saving creates, updates and deletes only Ovx’s own rules', async () => {
    const { guild, rules, calls } = fakeGuild({
        existing: [
            { id: 'mine', name: 'Hand-made rule' },
            { id: 'ovxSpam', name: 'Ovx · Spam' },
        ],
    });
    const automod = {
        ...automodDefaults(),
        mentions: { enabled: true, limit: 5, raidProtection: true, timeoutMinutes: 0 },
    };

    const result = await syncRules(guild, automod, { spam: 'ovxSpam' }, 'test');
    assert.deepEqual(result.problems, []);
    assert.equal(result.ruleIds.spam, null, 'spam was switched off, so its rule is deleted');
    assert.ok(result.ruleIds.mentions.startsWith('new'));
    assert.ok(rules.has('mine'), 'a rule made by hand in Discord is never touched');
    assert.deepEqual(
        calls.map(([kind]) => kind),
        ['delete', 'create']
    );

    // Saving again updates the same rule instead of making another
    const again = await syncRules(
        guild,
        { ...automod, mentions: { ...automod.mentions, limit: 9 } },
        result.ruleIds,
        'test'
    );
    assert.equal(again.ruleIds.mentions, result.ruleIds.mentions);
    assert.equal(calls.at(-1)[0], 'edit');
    assert.equal(calls.at(-1)[2].triggerMetadata.mentionTotalLimit, 9);
});

test('a rule deleted by hand in Discord is set up again, and one failing rule does not stop the rest', async () => {
    const { guild } = fakeGuild({ failOn: 'Ovx · Links' });
    const automod = { ...automodDefaults(), spam: { enabled: true }, links: { enabled: true, allowedSites: [] } };
    const result = await syncRules(guild, automod, { spam: 'deleted-in-discord' }, 'test');
    assert.ok(result.ruleIds.spam.startsWith('new'), 'recreated');
    assert.equal(result.ruleIds.links, null);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /^Links: .*as many AutoMod rules/);
});

test('without Manage Server nothing is changed, and the page says why', async () => {
    const { guild, calls } = fakeGuild({ canManage: false });
    const result = await syncRules(guild, { ...automodDefaults(), spam: { enabled: true } }, {}, 'test');
    assert.match(result.problems[0], /Manage Server/);
    assert.equal(calls.length, 0);
    assert.equal((await ruleStatus(guild, {})).canManage, false);
});

test('the page shows rules switched off or deleted in Discord', async () => {
    const { guild } = fakeGuild({
        existing: [
            { id: 's', name: 'Ovx · Spam', enabled: false },
            { id: 'other', name: 'Hand-made' },
        ],
    });
    const { status, otherRules } = await ruleStatus(guild, { spam: 's', links: 'gone' });
    assert.equal(status.spam, 'paused');
    assert.equal(status.links, 'missing');
    assert.equal(status.words, 'off');
    assert.equal(otherRules, 1);
});

// ---------- Anti-raid ----------

let config;
beforeEach(() => {
    resetRaidState();
    config = withAutomodDefaults('g', {
        automod: { alertChannelId: ALERTS },
        raid: { enabled: true, joins: 3, seconds: 30, action: 'timeout', pauseInvitesHours: 2, pingRoleId: ROLE },
    });
    Automod_Config_Cache.get = /** @type {any} */ (async () => config);
});

function raidGuild() {
    const alerts = [];
    const timedOut = [];
    const kicked = [];
    const dms = [];
    let pausedUntil = null;
    const members = new Map();
    const guild = {
        id: 'g',
        name: 'Test',
        preferredLocale: 'en-GB',
        members: { cache: members, me: { permissions: { has: () => true } } },
        channels: {
            cache: new Map([[ALERTS, { isSendable: () => true, send: async (message) => alerts.push(message) }]]),
        },
        setIncidentActions: async ({ invitesDisabledUntil }) => (pausedUntil = invitesDisabledUntil),
    };
    const join = (id, { ageDays = 365, now = Date.now() } = {}) => {
        const member = {
            id,
            guild,
            moderatable: true,
            kickable: true,
            user: { bot: false, createdTimestamp: now - ageDays * 86_400_000 },
            timeout: async () => timedOut.push(id),
            kick: async () => kicked.push(id),
            send: async (text) => dms.push({ id, text }),
        };
        members.set(id, member);
        return onMemberJoin(/** @type {any} */ (member), now);
    };
    return { join, alerts, timedOut, kicked, dms, paused: () => pausedUntil };
}

test('a burst of joins starts raid mode: staff alerted, invites paused, the joiners and later ones handled', async () => {
    const { join, alerts, timedOut, paused } = raidGuild();
    const now = Date.now();
    await join('a', { now });
    await join('b', { now: now + 1000 });
    assert.equal(alerts.length, 0, 'two joins is not a raid');

    await join('c', { now: now + 2000 });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].content, `<@&${ROLE}>`);
    assert.deepEqual(alerts[0].allowedMentions.roles, [ROLE]);
    assert.deepEqual(timedOut.sort(), ['a', 'b', 'c']);
    assert.ok(paused() instanceof Date);

    await join('d', { now: now + 60_000 });
    assert.ok(timedOut.includes('d'), 'joining during raid mode is handled too');
    assert.equal(alerts.length, 1, 'one alert per raid');
});

test('joins spread out over time are not a raid', async () => {
    const { join, alerts } = raidGuild();
    const now = Date.now();
    for (let i = 0; i < 5; i++) await join(`m${i}`, { now: now + i * 60_000 });
    assert.equal(alerts.length, 0);
});

test('accounts newer than the minimum are removed and told when they can come back', async () => {
    config.raid.minAccountDays = 7;
    const { join, kicked, dms } = raidGuild();
    await join('new', { ageDays: 2 });
    await join('old', { ageDays: 30 });
    assert.deepEqual(kicked, ['new']);
    assert.match(dms[0].text, /newer than 7 days/);
});
