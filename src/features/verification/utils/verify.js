import { randomInt } from 'node:crypto';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import Verification_Config_Cache from '../cache/verificationConfig.cache.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

/** Buttons and the code form: `vf:start`, `vf:enter`, `vf:code` */
export const VERIFY_PREFIX = 'vf:';
const CODE_CHARACTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No 0/O, 1/I/L: easy to read
const CODE_LENGTH = 5;
const CODE_TTL_MS = 5 * 60 * 1000;
const CODE_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const REASON = 'Verified with Ovx';

/**
 * @typedef {import('../models/verification.js').VerificationConfigType} VerificationConfigType
 */

/** "guildId:userId" → their current code, kept only in memory and only for a few minutes */
const codes = new Map();

/** For tests. */
export function resetCodes() {
    codes.clear();
}

/** A short code that's easy to read and type. */
export function makeCode(random = (max) => randomInt(max)) {
    return Array.from({ length: CODE_LENGTH }, () => CODE_CHARACTERS[random(CODE_CHARACTERS.length)]).join('');
}

/**
 * The verification panel.
 * @param {import('discord.js').Guild} guild
 * @param {VerificationConfigType} config
 * @returns {Promise<import('discord.js').MessageCreateOptions>}
 */
export async function verifyPanel(guild, config) {
    const embed = new EmbedBuilder()
        .setColor(await brandColour(guild.id))
        .setTitle(config.title)
        .setDescription(config.description);
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder()
            .setCustomId(`${VERIFY_PREFIX}start`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setLabel(config.buttonLabel)
    );
    return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

/**
 * Why a member can't verify (a translation key and values), or null if they can.
 * @param {import('discord.js').GuildMember} member
 * @param {VerificationConfigType} config
 * @param {number} now
 */
export function verifyBlocker(member, config, now) {
    const role = config.roleId ? member.guild.roles.cache.get(config.roleId) : null;
    if (!config.enabled || !role) return { key: 'off' };
    if (member.roles.cache.has(role.id)) return { key: 'already' };
    const me = member.guild.members.me;
    if (
        !me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
        role.managed ||
        role.position >= me.roles.highest.position
    ) {
        return { key: 'cannot_give' };
    }
    if (config.minAccountDays > 0 && now - member.user.createdTimestamp < config.minAccountDays * DAY_MS) {
        const ready = Math.ceil((member.user.createdTimestamp + config.minAccountDays * DAY_MS) / 1000);
        return { key: 'too_new', vars: { days: config.minAccountDays, when: `<t:${ready}:R>` } };
    }
    return null;
}

/**
 * Gives the verified role (and takes the unverified one away).
 * @param {import('discord.js').GuildMember} member
 * @param {VerificationConfigType} config
 */
async function grant(member, config) {
    await member.roles.add(/** @type {string} */ (config.roleId), REASON);
    if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
        await member.roles.remove(config.unverifiedRoleId, REASON).catch(() => {});
    }
}

/**
 * The Verify button, the "Enter code" button and the code form.
 * @param {import('discord.js').ButtonInteraction<'cached'> | import('discord.js').ModalSubmitInteraction<'cached'>} interaction
 * @param {number} [now]
 */
export async function handleVerify(interaction, now = Date.now()) {
    const t = (key, vars) => interaction.client.utils.Translate(`verification.${key}`, interaction.locale, vars);
    const reply = (key, vars) => interaction.reply({ content: t(key, vars), flags: MessageFlags.Ephemeral });
    const action = interaction.customId.slice(VERIFY_PREFIX.length);
    const config = await Verification_Config_Cache.get(interaction.guildId);
    const blocker = verifyBlocker(interaction.member, config, now);
    if (blocker) return reply(blocker.key, blocker.vars);

    const key = `${interaction.guildId}:${interaction.user.id}`;

    if (action === 'start') {
        if (config.method !== 'code') {
            await grant(interaction.member, config);
            return reply('done');
        }
        // Codes nobody entered are cleared out as new ones are made
        for (const [other, pending] of codes) if (pending.expires < now) codes.delete(other);
        const code = makeCode();
        codes.set(key, { code, expires: now + CODE_TTL_MS, attempts: 0 });
        const enter = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
            new ButtonBuilder()
                .setCustomId(`${VERIFY_PREFIX}enter`)
                .setStyle(ButtonStyle.Primary)
                .setLabel(t('enter_button'))
        );
        return interaction.reply({
            content: t('code_prompt', { code: code.split('').join(' ') }),
            components: [enter],
            flags: MessageFlags.Ephemeral,
        });
    }

    if (action === 'enter') {
        if (!codes.has(key)) return reply('code_expired');
        const modal = new ModalBuilder().setCustomId(`${VERIFY_PREFIX}code`).setTitle(t('code_title'));
        modal.addComponents(
            /** @type {ActionRowBuilder<TextInputBuilder>} */ (new ActionRowBuilder()).addComponents(
                new TextInputBuilder()
                    .setCustomId('code')
                    .setLabel(t('code_label'))
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(CODE_LENGTH)
                    .setMaxLength(CODE_LENGTH + 4)
            )
        );
        return /** @type {any} */ (interaction).showModal(modal);
    }

    if (action === 'code' && interaction.isModalSubmit()) {
        const pending = codes.get(key);
        if (!pending || pending.expires < now) {
            codes.delete(key);
            return reply('code_expired');
        }
        const typed = interaction.fields.getTextInputValue('code').replace(/\s+/g, '').toUpperCase();
        if (typed !== pending.code) {
            pending.attempts++;
            if (pending.attempts >= CODE_ATTEMPTS) {
                codes.delete(key);
                return reply('code_too_many');
            }
            return reply('code_wrong', { left: CODE_ATTEMPTS - pending.attempts });
        }
        codes.delete(key);
        await grant(interaction.member, config);
        return reply('done');
    }
}

/**
 * New members get the unverified role, if the server uses one.
 * @param {import('discord.js').GuildMember} member
 */
export async function onJoin(member) {
    if (member.user.bot) return;
    const config = await Verification_Config_Cache.get(member.guild.id);
    if (!config.enabled || !config.unverifiedRoleId) return;
    await member.roles.add(config.unverifiedRoleId, 'Not verified yet').catch((error) => {
        LogData(
            'Verification',
            `Guild: ${member.guild.name} | Could not give the unverified role: ${error.message}`,
            'warning'
        );
    });
}

/** Servers fetched in full at most this often, and only up to this size, for the removal sweep */
const FETCH_MAX_MEMBERS = 25_000;

/**
 * Removes members who joined more than `kickAfterHours` ago and still haven't verified, telling them they can rejoin.
 * @param {import('discord.js').Client} client
 * @param {number} [now]
 * @returns {Promise<number>} How many were removed
 */
export async function removeUnverified(client, now = Date.now()) {
    let removed = 0;
    for (const guild of client.guilds.cache.values()) {
        const config = await Verification_Config_Cache.get(guild.id);
        if (!config.enabled || !config.roleId || config.kickAfterHours <= 0) continue;
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) continue;
        if (guild.memberCount <= FETCH_MAX_MEMBERS) await guild.members.fetch().catch(() => {});

        const cutoff = now - config.kickAfterHours * 60 * 60 * 1000;
        const waiting = guild.members.cache.filter(
            (member) =>
                !member.user.bot &&
                !member.roles.cache.has(config.roleId) &&
                (member.joinedTimestamp ?? now) < cutoff &&
                member.kickable
        );
        for (const member of waiting.values()) {
            await member
                .send(
                    Translate('verification.removed_dm', guild.preferredLocale, {
                        server: guild.name,
                        hours: config.kickAfterHours,
                    })
                )
                .catch(() => {});
            await member
                .kick(`Did not verify within ${config.kickAfterHours} hours`)
                .then(() => removed++)
                .catch(() => {});
        }
    }
    return removed;
}
