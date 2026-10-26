import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { TempChannel } from '../models/tempVoice.js';
import { TEMP_VOICE_PREFIX, channelState, controlPanel } from './panel.js';

/** Discord lets a channel be renamed twice every 10 minutes. */
export const RENAME_WINDOW_MS = 10 * 60 * 1000;
export const RENAMES_PER_WINDOW = 2;

/**
 * @typedef {import('discord.js').ButtonInteraction<'cached'> | import('discord.js').ModalSubmitInteraction<'cached'>
 *   | import('discord.js').UserSelectMenuInteraction<'cached'>} ControlInteraction
 */

/**
 * @param {ControlInteraction} interaction
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
const t = (interaction, key, vars) =>
    interaction.client.utils.Translate(`tempVoice.controls.${key}`, interaction.locale, vars);

/** @param {ControlInteraction} interaction @param {string} key @param {Record<string, string | number>} [vars] */
const reply = (interaction, key, vars) =>
    interaction.reply({
        content: t(interaction, key, vars),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });

/**
 * When the next rename is allowed, or null if it's allowed now.
 * @param {any[]} renames - Dates of recent renames
 * @param {number} now
 */
export function nextRenameAt(renames, now) {
    const recent = renames.map((date) => new Date(date).getTime()).filter((time) => now - time < RENAME_WINDOW_MS);
    if (recent.length < RENAMES_PER_WINDOW) return null;
    return Math.min(...recent) + RENAME_WINDOW_MS;
}

/**
 * Updates the control panel (after the owner or lock state changes).
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {{ ownerId: string, panelMessageId?: string | null }} record
 */
async function refreshPanel(channel, record) {
    if (!record.panelMessageId) return;
    const message = await channel.messages.fetch(record.panelMessageId).catch(() => null);
    await message?.edit(await controlPanel(channel, record.ownerId)).catch(() => {});
}

/**
 * Gives someone owner rights on the channel, and takes them from the old owner.
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {string} oldOwnerId
 * @param {string} newOwnerId
 */
async function changeOwner(channel, oldOwnerId, newOwnerId) {
    await channel.permissionOverwrites.edit(newOwnerId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
        UseVAD: true,
    });
    if (oldOwnerId !== newOwnerId) await channel.permissionOverwrites.delete(oldOwnerId).catch(() => {});
    const record = await TempChannel.findOneAndUpdate(
        { channelId: channel.id },
        { $set: { ownerId: newOwnerId } },
        { returnDocument: 'after' }
    ).lean();
    if (record) await refreshPanel(channel, record);
}

/**
 * A control panel button, form or member picker.
 * @param {ControlInteraction} interaction
 */
export async function handleControl(interaction) {
    const action = interaction.customId.slice(TEMP_VOICE_PREFIX.length);
    const channel = interaction.channel;
    if (!channel?.isVoiceBased()) return reply(interaction, 'not_temp');

    const record = await TempChannel.findOne({ channelId: channel.id }).lean();
    if (!record) return reply(interaction, 'not_temp');

    const member = interaction.member;
    const isOwner = record.ownerId === member.id;
    const isStaff = member.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels);

    if (action === 'claim') {
        if (isOwner) return reply(interaction, 'already_owner');
        if (member.voice.channelId !== channel.id) return reply(interaction, 'join_first');
        if (channel.members.has(record.ownerId) && !isStaff)
            return reply(interaction, 'owner_here', { owner: `<@${record.ownerId}>` });
        await changeOwner(channel, record.ownerId, member.id);
        return reply(interaction, 'claimed');
    }

    if (!isOwner && !isStaff) return reply(interaction, 'not_owner', { owner: `<@${record.ownerId}>` });

    if (action === 'rename') {
        const wait = nextRenameAt(record.renames ?? [], Date.now());
        if (wait) return reply(interaction, 'rename_wait', { when: `<t:${Math.ceil(wait / 1000)}:R>` });
        const modal = new ModalBuilder()
            .setCustomId(`${TEMP_VOICE_PREFIX}rename-form`)
            .setTitle(t(interaction, 'rename_title'));
        modal.addComponents(
            /** @type {ActionRowBuilder<TextInputBuilder>} */ (new ActionRowBuilder()).addComponents(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel(t(interaction, 'rename_label'))
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setValue(channel.name)
            )
        );
        return /** @type {any} */ (interaction).showModal(modal);
    }

    if (action === 'rename-form' && interaction.isModalSubmit()) {
        const name = interaction.fields.getTextInputValue('name').trim();
        if (!name) return reply(interaction, 'rename_empty');
        const now = Date.now();
        const wait = nextRenameAt(record.renames ?? [], now);
        if (wait) return reply(interaction, 'rename_wait', { when: `<t:${Math.ceil(wait / 1000)}:R>` });
        await channel.setName(name, `Renamed by @${member.user.username}`);
        /** @type {any[]} */
        const previous = record.renames ?? [];
        const renames = [...previous, new Date(now)].filter(
            (date) => now - new Date(date).getTime() < RENAME_WINDOW_MS
        );
        await TempChannel.updateOne({ channelId: channel.id }, { $set: { renames } });
        return reply(interaction, 'renamed', { name });
    }

    if (action === 'limit') {
        const modal = new ModalBuilder()
            .setCustomId(`${TEMP_VOICE_PREFIX}limit-form`)
            .setTitle(t(interaction, 'limit_title'));
        modal.addComponents(
            /** @type {ActionRowBuilder<TextInputBuilder>} */ (new ActionRowBuilder()).addComponents(
                new TextInputBuilder()
                    .setCustomId('limit')
                    .setLabel(t(interaction, 'limit_label'))
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(2)
                    .setRequired(false)
                    .setValue(String(channel.userLimit ?? 0))
            )
        );
        return /** @type {any} */ (interaction).showModal(modal);
    }

    if (action === 'limit-form' && interaction.isModalSubmit()) {
        const value = interaction.fields.getTextInputValue('limit').trim() || '0';
        const limit = Number(value);
        if (!/^\d{1,2}$/.test(value) || limit > 99) return reply(interaction, 'limit_invalid');
        await channel.setUserLimit(limit, `Changed by @${member.user.username}`);
        return reply(interaction, limit === 0 ? 'limit_removed' : 'limit_set', { limit });
    }

    if (action === 'lock' || action === 'hide') {
        const { locked, hidden } = channelState(channel);
        const permission = action === 'lock' ? 'Connect' : 'ViewChannel';
        const turningOn = action === 'lock' ? !locked : !hidden;
        // Removing the override (null) brings back whatever the category allows
        await channel.permissionOverwrites.edit(channel.guild.id, { [permission]: turningOn ? false : null });
        await refreshPanel(channel, record);
        return reply(interaction, `${action}_${turningOn ? 'on' : 'off'}`);
    }

    if (action === 'kick' || action === 'transfer') {
        const picker = new UserSelectMenuBuilder()
            .setCustomId(`${TEMP_VOICE_PREFIX}${action}-select`)
            .setPlaceholder(t(interaction, `${action}_placeholder`))
            .setMinValues(1)
            .setMaxValues(1);
        return interaction.reply({
            content: t(interaction, `${action}_prompt`),
            components: [
                /** @type {ActionRowBuilder<UserSelectMenuBuilder>} */ (new ActionRowBuilder()).addComponents(picker),
            ],
            flags: MessageFlags.Ephemeral,
        });
    }

    if ((action === 'kick-select' || action === 'transfer-select') && interaction.isUserSelectMenu()) {
        const [targetId] = interaction.values;
        const target = channel.members.get(targetId);
        const update = (key, vars) =>
            interaction.update({ content: t(interaction, key, vars), components: [], allowedMentions: { parse: [] } });
        if (targetId === member.id) return update('not_yourself');
        if (!target) return update('not_in_channel', { user: `<@${targetId}>` });

        if (action === 'transfer-select') {
            if (target.user.bot) return update('not_a_bot');
            await changeOwner(channel, record.ownerId, targetId);
            return update('transferred', { user: `${target}` });
        }
        if (targetId === record.ownerId) return update('not_owner_kick');
        // Disconnected, and kept out until the channel is gone
        await channel.permissionOverwrites.edit(targetId, { Connect: false });
        await target.voice.disconnect(`Removed from their channel by @${member.user.username}`).catch(() => {});
        return update('kicked', { user: `${target}` });
    }

    return reply(interaction, 'not_temp');
}
