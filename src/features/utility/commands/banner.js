import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { imageReply, memberImageHash, memberImageUrl } from '../utils/profileImages.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('banner');
commandData.setDescription("Show someone's profile banner in full size.");
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);
commandData.addUserOption((option) => option.setName('user').setDescription('Whose banner (default: yours).'));

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * Their profile banner, and their server banner too if they set one for this server.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client, locale, guildId } = interaction;
    const t = (key, vars) => client.utils.Translate(`commands.banner.${key}`, locale, vars);
    const chosen = interaction.options.getUser('user') ?? interaction.user;
    const colourGuild = interaction.inCachedGuild() ? guildId : null;

    // Banners aren't sent with a user, so the full profile is fetched
    const user = await chosen.fetch(true).catch(() => chosen);
    const replies = [];

    const banner = user.bannerURL({ size: 4096 });
    if (banner) {
        replies.push(
            await imageReply({ title: t('title', { user: user.username }), url: banner, guildId: colourGuild })
        );
    }

    const member = interaction.options.getUser('user') ? interaction.options.getMember('user') : interaction.member;
    const serverHash = guildId ? memberImageHash(member, 'banner') : null;
    if (serverHash) {
        replies.push(
            await imageReply({
                title: t('server_title', { user: user.username }),
                url: memberImageUrl(guildId, user.id, serverHash, 'banner'),
                guildId: colourGuild,
            })
        );
    }

    if (replies.length === 0) {
        // Without a banner, Discord shows their profile colour instead
        const colour = user.hexAccentColor;
        const embed = new EmbedBuilder()
            .setColor(colour ?? (await brandColour(colourGuild)))
            .setTitle(t('none_title'))
            .setDescription(
                colour ? t('none_colour', { user: user.username, colour }) : t('none', { user: user.username })
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        embeds: replies.map((reply) => reply.embed),
        components: replies.map((reply) => reply.row),
    });
}
