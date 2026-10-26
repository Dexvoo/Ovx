import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GuildVerificationLevel, GuildPremiumTier } from 'discord.js';
import { describeGuildChanges } from '../src/features/logging/utils/serverChanges.js';

const base = {
    name: 'Drift Kings',
    description: null,
    icon: 'a',
    banner: null,
    splash: null,
    discoverySplash: null,
    afkChannelId: null,
    afkTimeout: 300,
    systemChannelId: '1',
    rulesChannelId: null,
    publicUpdatesChannelId: null,
    safetyAlertsChannelId: null,
    verificationLevel: GuildVerificationLevel.Low,
    explicitContentFilter: 0,
    defaultMessageNotifications: 0,
    mfaLevel: 0,
    nsfwLevel: 0,
    premiumTier: GuildPremiumTier.None,
    vanityURLCode: null,
    preferredLocale: 'en-US',
    premiumProgressBarEnabled: false,
    ownerId: '10',
    memberCount: 5,
};
const guild = (changes = {}) => /** @type {any} */ ({ ...base, ...changes });

test('describes server setting changes in readable words', () => {
    const after = guild({
        name: 'Drift Queens',
        icon: 'b',
        banner: 'c',
        afkChannelId: '2',
        afkTimeout: 900,
        verificationLevel: GuildVerificationLevel.VeryHigh,
        premiumTier: GuildPremiumTier.Tier1,
        premiumProgressBarEnabled: true,
        ownerId: '11',
    });

    assert.deepEqual(describeGuildChanges(guild(), after), [
        '**Name:** `Drift Kings` → `Drift Queens`',
        '**Icon:** Changed',
        '**Banner:** Added',
        '**AFK Channel:** `None` → <#2>',
        '**AFK Timeout:** `5 min` → `15 min`',
        '**Verification Level:** `Low` → `Very High`',
        '**Boost Level:** `None` → `Tier1`',
        '**Boost Progress Bar:** `Off` → `On`',
        '**Owner:** <@10> → <@11>',
    ]);
});

test('changes that are not settings (like the member count) are ignored', () => {
    assert.deepEqual(describeGuildChanges(guild(), guild({ memberCount: 6 })), []);
});

test('removed images and channels are described', () => {
    assert.deepEqual(describeGuildChanges(guild(), guild({ icon: null, systemChannelId: null })), [
        '**Icon:** Removed',
        '**System Messages Channel:** <#1> → `None`',
    ]);
});
