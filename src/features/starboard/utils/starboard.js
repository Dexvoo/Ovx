import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { StarboardPost } from '../models/starboard.js';
import Starboard_Config_Cache from '../cache/starboardConfig.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

const STAR_COLOUR = '#f5b301';
const VARIATION_SELECTOR = /️/g;
const POST_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * @typedef {import('../models/starboard.js').StarboardConfigType} StarboardConfigType
 */

/**
 * Whether a reaction is the server's star emoji. Unicode emojis are compared without the invisible
 * variation selector, since "⭐" and "⭐️" are the same star.
 * @param {{ id: string | null, name: string | null }} reactionEmoji
 * @param {string} configured - A Unicode emoji or <:name:id>
 */
export function isStarEmoji(reactionEmoji, configured) {
    const custom = /^<a?:\w+:(\d+)>$/.exec(configured);
    if (custom) return reactionEmoji.id === custom[1];
    return (
        !reactionEmoji.id &&
        (reactionEmoji.name ?? '').replace(VARIATION_SELECTOR, '') === configured.replace(VARIATION_SELECTOR, '')
    );
}

/**
 * The emoji shown with the count. The default star grows as a message gets more popular.
 * @param {string} configured
 * @param {number} stars
 */
export function countEmoji(configured, stars) {
    if (configured.replace(VARIATION_SELECTOR, '') !== '⭐') return configured;
    if (stars >= 25) return '✨';
    if (stars >= 10) return '💫';
    if (stars >= 5) return '🌟';
    return '⭐';
}

/**
 * Why a message can't go on the starboard, or null if it can.
 * @param {import('discord.js').Message<true>} message
 * @param {StarboardConfigType} config
 */
export function starboardBlocker(message, config) {
    if (!config.enabled || !config.channelId) return 'off';
    const { channel } = message;
    // Stars on the starboard's own posts don't count
    if (channel.id === config.channelId) return 'starboard';
    const parentId = channel.isThread() ? channel.parentId : null;
    if (config.ignoredChannelIds.includes(channel.id) || (parentId && config.ignoredChannelIds.includes(parentId))) {
        return 'ignored';
    }
    if (message.author?.bot && !config.allowBots) return 'bot';
    if (message.system) return 'system';
    // Age-restricted messages only go to an age-restricted starboard
    const starboard = message.guild.channels.cache.get(config.channelId);
    const nsfw = (c) => Boolean(c && 'nsfw' in c && c.nsfw);
    const sourceNsfw = nsfw(channel) || nsfw(channel.isThread() ? channel.parent : null);
    if (sourceNsfw && !nsfw(starboard)) return 'nsfw';
    return null;
}

/**
 * Stars on a message, not counting bots or (unless allowed) the author's own.
 * @param {import('discord.js').Message<true>} message
 * @param {StarboardConfigType} config
 */
export async function countStars(message, config) {
    const reaction = message.reactions.cache.find((item) => isStarEmoji(item.emoji, config.emoji));
    if (!reaction) return 0;
    // Discord gives up to 100 reactors per request; beyond that the total is close enough
    const users = await reaction.users.fetch({ limit: 100 }).catch(() => null);
    if (!users || reaction.count > 100) return reaction.count;
    return users.filter((user) => !user.bot && (config.selfStar || user.id !== message.author?.id)).size;
}

/**
 * The first image in a message: an attachment, or an image link's preview.
 * @param {import('discord.js').Message} message
 */
function firstImage(message) {
    const attachment = message.attachments.find((file) => file.contentType?.startsWith('image/'));
    if (attachment) return attachment.url;
    const embed = message.embeds.find((item) => item.image?.url || item.thumbnail?.url);
    return embed?.image?.url ?? embed?.thumbnail?.url ?? null;
}

/**
 * The starboard post for a message.
 * @param {import('discord.js').Message<true>} message
 * @param {number} stars
 * @param {StarboardConfigType} config
 * @returns {Promise<import('discord.js').MessageCreateOptions>}
 */
export async function starboardPost(message, stars, config) {
    const locale = message.guild.preferredLocale;
    const t = (key, vars) => Translate(`starboard.${key}`, locale, vars);
    const author = message.member ?? message.author;

    const embed = new EmbedBuilder()
        .setColor(STAR_COLOUR)
        .setAuthor({
            name: message.member?.displayName ?? message.author.displayName,
            iconURL: author.displayAvatarURL({ size: 64 }),
        })
        .setTimestamp(message.createdAt)
        .setFooter({ text: `ID: ${message.id}` });

    const text = message.content || message.embeds[0]?.description || '';
    if (text) embed.setDescription(text.slice(0, 4000));

    // Replying to someone: show what they replied to
    if (message.reference?.messageId) {
        const replied = await message.fetchReference().catch(() => null);
        if (replied) {
            const snippet = (replied.content || t('no_text')).slice(0, 200);
            embed.addFields({ name: t('replying_to', { user: replied.author.displayName }), value: snippet });
        }
    }

    const image = firstImage(message);
    if (image) embed.setImage(image);
    const otherFiles = message.attachments.filter((file) => file.url !== image);
    if (otherFiles.size > 0) {
        embed.addFields({
            name: t('attachments'),
            value: otherFiles
                .map((file) => `[${file.name}](${file.url})`)
                .join('\n')
                .slice(0, 1024),
        });
    }

    const jump = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t('jump')).setURL(message.url)
    );
    return {
        content: `${countEmoji(config.emoji, stars)} **${stars}** | ${message.channel}`,
        embeds: [embed],
        components: [jump],
        allowedMentions: { parse: [] },
    };
}

/** Message ID → its update in progress. Updates for one message run one at a time, so it's never posted twice. */
const queues = new Map();

/**
 * Runs the update for a message after any update already running for it.
 * @param {string} messageId
 * @param {() => Promise<void>} task
 */
function queue(messageId, task) {
    const previous = queues.get(messageId) ?? Promise.resolve();
    const next = previous.then(task, task).finally(() => {
        if (queues.get(messageId) === next) queues.delete(messageId);
    });
    queues.set(messageId, next);
    return next;
}

/**
 * Brings a message's starboard post up to date: posts it when it reaches the threshold, updates the count,
 * and (if set) takes it down when it drops below again.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} input
 */
export function updateStarboard(input) {
    return queue(input.id, async () => {
        const message = input.partial ? await input.fetch().catch(() => null) : input;
        if (!message?.inGuild()) return;
        const config = await Starboard_Config_Cache.get(message.guild.id);
        if (starboardBlocker(message, config)) return;

        const entry = await StarboardPost.findOne({ messageId: message.id }).lean();
        if (entry?.removed) return; // A moderator took it down

        const stars = await countStars(message, config);
        const postedIn = entry?.starboardMessageId ? message.guild.channels.cache.get(entry.starboardChannelId) : null;

        // Not on the starboard yet
        if (!entry?.starboardMessageId || !postedIn?.isTextBased()) {
            if (stars < config.threshold) return;
            const starboard = message.guild.channels.cache.get(config.channelId);
            const me = message.guild.members.me;
            if (!starboard?.isTextBased() || !me || !starboard.permissionsFor(me).has(POST_PERMISSIONS)) {
                LogData('Starboard', `Guild: ${message.guild.name} | Can't post in the starboard channel`, 'debug');
                return;
            }
            const posted = await starboard.send(await starboardPost(message, stars, config));
            await StarboardPost.updateOne(
                { messageId: message.id },
                {
                    $set: {
                        guildId: message.guild.id,
                        channelId: message.channel.id,
                        authorId: message.author.id,
                        starboardChannelId: starboard.id,
                        starboardMessageId: posted.id,
                        stars,
                    },
                },
                { upsert: true }
            );
            return;
        }

        // Dropped below the threshold: taken down, and can come back if it's starred again
        if (stars < config.threshold && config.removeBelow) {
            await postedIn.messages.delete(entry.starboardMessageId).catch(() => {});
            await StarboardPost.deleteOne({ messageId: message.id });
            return;
        }

        if (stars === entry.stars) return;
        const existing = await postedIn.messages.fetch(entry.starboardMessageId).catch(() => null);
        if (!existing) {
            await StarboardPost.deleteOne({ messageId: message.id }); // Gone some other way: re-posted next time
            return;
        }
        await existing.edit(await starboardPost(message, stars, config));
        await StarboardPost.updateOne({ messageId: message.id }, { $set: { stars } });
    }).catch((error) => LogData('Starboard', `Update for ${input.id} failed: ${error.message}`, 'warning'));
}

/**
 * A deleted message: if it was starred, its post goes; if it was a starboard post, it isn't posted again.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} message
 */
export async function handleDeletedMessage(message) {
    if (!message.guildId) return;
    // Runs for every deleted message: servers that never set a starboard up are skipped without a lookup
    const config = await Starboard_Config_Cache.get(message.guildId);
    if (!config.channelId) return;
    const starred = await StarboardPost.findOne({ messageId: message.id }).lean();
    if (starred) {
        const channel = starred.starboardChannelId
            ? message.guild?.channels.cache.get(starred.starboardChannelId)
            : null;
        if (channel?.isTextBased() && starred.starboardMessageId) {
            await channel.messages.delete(starred.starboardMessageId).catch(() => {});
        }
        await StarboardPost.deleteOne({ messageId: message.id });
        return;
    }
    // A moderator deleted a starboard post: remember, so more stars don't post it again
    await StarboardPost.updateOne(
        { starboardMessageId: message.id },
        { $set: { removed: true, starboardMessageId: null } }
    );
}
