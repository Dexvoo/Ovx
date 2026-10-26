import { ApplicationCommandOptionType } from 'discord.js';
import { UsageDay } from '../models/usageDay.js';

/**
 * Usage is counted in memory and written once a minute (see events/usageFlush.js), so a command never waits
 * on the database for it. Each shard keeps its own counts; the writes add up.
 */
let pending = emptyBuffer();

function emptyBuffer() {
    return { commands: new Map(), guilds: new Set(), joins: 0, leaves: 0 };
}

/** "2026-10-13" in UTC. */
export function dayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

/** Field names can't contain "." or start with "$" in MongoDB. */
function safeName(name) {
    return name.replace(/[.$]/g, '_');
}

/**
 * "moderation ban", "leveladmin xp add", "Translate": the command with its subcommand.
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').ContextMenuCommandInteraction} interaction
 */
export function commandKey(interaction) {
    const parts = [interaction.commandName];
    let options = interaction.options?.data ?? [];
    while (options.length === 1 && options[0].type <= ApplicationCommandOptionType.SubcommandGroup) {
        parts.push(options[0].name);
        options = options[0].options ?? [];
    }
    return parts.join(' ');
}

/**
 * @param {string} command
 * @param {string | null} guildId - null in DMs
 */
export function recordCommand(command, guildId) {
    const name = safeName(command);
    pending.commands.set(name, (pending.commands.get(name) ?? 0) + 1);
    if (guildId) pending.guilds.add(guildId);
}

/** @param {'joins' | 'leaves'} kind */
export function recordGuildChange(kind) {
    pending[kind]++;
}

/**
 * Writes what was counted since the last flush. On failure the counts are kept for the next try.
 * @param {Date} [now]
 * @returns {Promise<boolean>} Whether anything was written
 */
export async function flushUsage(now = new Date()) {
    const buffer = pending;
    if (buffer.commands.size === 0 && buffer.joins === 0 && buffer.leaves === 0) return false;
    pending = emptyBuffer();

    const inc = { joins: buffer.joins, leaves: buffer.leaves };
    for (const [name, count] of buffer.commands) inc[`commands.${name}`] = count;
    try {
        await UsageDay.updateOne(
            { day: dayKey(now) },
            { $inc: inc, $addToSet: { guilds: { $each: [...buffer.guilds] } } },
            { upsert: true }
        );
        return true;
    } catch (error) {
        // Put back, added to anything counted meanwhile
        for (const [name, count] of buffer.commands) {
            pending.commands.set(name, (pending.commands.get(name) ?? 0) + count);
        }
        for (const guildId of buffer.guilds) pending.guilds.add(guildId);
        pending.joins += buffer.joins;
        pending.leaves += buffer.leaves;
        throw error;
    }
}
