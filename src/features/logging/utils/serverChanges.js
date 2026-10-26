import {
    GuildVerificationLevel,
    GuildExplicitContentFilter,
    GuildDefaultMessageNotifications,
    GuildMFALevel,
    GuildNSFWLevel,
    GuildPremiumTier,
} from 'discord.js';

/**
 * Describes what changed in a server's settings, one line per change, for the server logs.
 * Pure (only reads the two guild snapshots) so it can be unit-tested.
 *
 * @param {import('discord.js').Guild} oldGuild
 * @param {import('discord.js').Guild} newGuild
 * @returns {string[]}
 */
export function describeGuildChanges(oldGuild, newGuild) {
    const lines = [];
    const changed = (key) => oldGuild[key] !== newGuild[key];

    if (changed('name')) lines.push(`**Name:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
    if (changed('description')) {
        lines.push(`**Description:** \`${oldGuild.description || 'None'}\` → \`${newGuild.description || 'None'}\``);
    }

    for (const [key, label] of IMAGES) {
        if (changed(key)) lines.push(`**${label}:** ${imageChange(oldGuild[key], newGuild[key])}`);
    }

    for (const [key, label] of CHANNELS) {
        if (changed(key)) lines.push(`**${label}:** ${channel(oldGuild[key])} → ${channel(newGuild[key])}`);
    }
    if (changed('afkTimeout')) {
        lines.push(`**AFK Timeout:** \`${minutes(oldGuild.afkTimeout)}\` → \`${minutes(newGuild.afkTimeout)}\``);
    }

    for (const [key, label, values] of ENUMS) {
        if (changed(key)) {
            lines.push(`**${label}:** \`${enumName(values, oldGuild[key])}\` → \`${enumName(values, newGuild[key])}\``);
        }
    }

    if (changed('vanityURLCode')) {
        lines.push(`**Vanity URL:** \`${oldGuild.vanityURLCode ?? 'None'}\` → \`${newGuild.vanityURLCode ?? 'None'}\``);
    }
    if (changed('preferredLocale')) {
        lines.push(`**Language:** \`${oldGuild.preferredLocale}\` → \`${newGuild.preferredLocale}\``);
    }
    if (changed('premiumProgressBarEnabled')) {
        lines.push(
            `**Boost Progress Bar:** \`${onOff(oldGuild.premiumProgressBarEnabled)}\` → \`${onOff(newGuild.premiumProgressBarEnabled)}\``
        );
    }
    if (changed('ownerId')) lines.push(`**Owner:** <@${oldGuild.ownerId}> → <@${newGuild.ownerId}>`);

    return lines;
}

/** @type {[keyof import('discord.js').Guild, string][]} */
const IMAGES = [
    ['icon', 'Icon'],
    ['banner', 'Banner'],
    ['splash', 'Invite Background'],
    ['discoverySplash', 'Discovery Background'],
];

/** @type {[keyof import('discord.js').Guild, string][]} */
const CHANNELS = [
    ['afkChannelId', 'AFK Channel'],
    ['systemChannelId', 'System Messages Channel'],
    ['rulesChannelId', 'Rules Channel'],
    ['publicUpdatesChannelId', 'Community Updates Channel'],
    ['safetyAlertsChannelId', 'Safety Alerts Channel'],
];

/** @type {[keyof import('discord.js').Guild, string, Record<number, string>][]} */
const ENUMS = [
    ['verificationLevel', 'Verification Level', GuildVerificationLevel],
    ['explicitContentFilter', 'Explicit Content Filter', GuildExplicitContentFilter],
    ['defaultMessageNotifications', 'Default Notifications', GuildDefaultMessageNotifications],
    ['mfaLevel', '2FA for Moderation', GuildMFALevel],
    ['nsfwLevel', 'NSFW Level', GuildNSFWLevel],
    ['premiumTier', 'Boost Level', GuildPremiumTier],
];

const onOff = (value) => (value ? 'On' : 'Off');
const channel = (id) => (id ? `<#${id}>` : '`None`');
const minutes = (seconds) => `${Math.round(seconds / 60)} min`;

/** "AllMembers" → "All Members" */
function enumName(values, value) {
    const name = values[value];
    return typeof name === 'string' ? name.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Unknown';
}

function imageChange(before, after) {
    if (!before) return 'Added';
    if (!after) return 'Removed';
    return 'Changed';
}
