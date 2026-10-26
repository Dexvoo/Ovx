import { MessageFlags, EmbedBuilder } from 'discord.js';
import User_Level_Cache from '../cache/userLevels.cache.js';
import { ExpForLevel, progressBar } from '../utils/levels.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @typedef {import('../models/guildLevels.js').GuildLevelsType} GuildLevelsType
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param { GuildLevelsType } guildConfig
 */

export async function execute(interaction, guildConfig) {
    const { client, options, guild } = interaction;

    if (!guildConfig)
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            client.utils.Translate('errors.no_config_found_generic', interaction.locale),
            { flags: MessageFlags.Ephemeral }
        );

    if (!guildConfig.enabled)
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            client.utils.Translate('commands.level_rank.not_configured_prompt', interaction.locale)
        );

    const user = options.getUser('user') || interaction.user;

    if (user.bot)
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            client.utils.Translate('commands.level_rank.not_configured_prompt', interaction.locale, { user })
        );

    const userConfig = await User_Level_Cache.get(guild.id, user.id);
    if (!userConfig)
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            client.utils.Translate('commands.level_rank.not_levelled_yet', interaction.locale, { user })
        );

    if (userConfig.level === 0 && userConfig.xp === 0)
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            client.utils.Translate('commands.level_rank.not_levelled_yet', interaction.locale, { user })
        );

    // Progress within the current level, not total XP against one level's requirement
    const xpIntoLevel = userConfig.xp - ExpForLevel(userConfig.level);
    const xpForNextLevel = ExpForLevel(userConfig.level + 1) - ExpForLevel(userConfig.level);
    const atMaxLevel = userConfig.level >= (guildConfig.maxLevel ?? Infinity);
    const xpText = atMaxLevel
        ? `Max level (${userConfig.xp.toLocaleString()} XP)`
        : progressBar(xpIntoLevel, xpForNextLevel);
    const title = `@${user.username}'s Rank`;

    const embed = new EmbedBuilder()
        .setColor(await brandColour(interaction.guildId))
        .setTitle(title)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: 'Level', value: `**${userConfig.level}**`, inline: true },
            { name: 'XP', value: `**${xpText}**`, inline: true },
            { name: 'Messages', value: `**${userConfig.totalMessages.toLocaleString()}**`, inline: true },
            {
                name: 'Voice',
                value: `**${Math.floor(userConfig.totalVoice / 60)}h ${userConfig.totalVoice % 60}m**`,
                inline: true,
            }
        )
        .setImage('https://i.sstatic.net/Fzh0w.png');

    interaction.reply({ embeds: [embed] });
}
