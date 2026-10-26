import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { imageReply, memberImageHash, memberImageUrl } from '../utils/profileImages.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('avatar');
commandData.setDescription("Show someone's profile picture in full size.");
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);
commandData.addUserOption((option) => option.setName('user').setDescription('Whose avatar (default: yours).'));

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * Their main avatar, and their server avatar too if they set one for this server.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client, locale, guildId } = interaction;
    const t = (key, vars) => client.utils.Translate(`commands.avatar.${key}`, locale, vars);
    const user = interaction.options.getUser('user') ?? interaction.user;
    // Only servers Ovx is in have their own colour
    const colourGuild = interaction.inCachedGuild() ? guildId : null;

    const main = await imageReply({
        title: t('title', { user: user.username }),
        url: user.displayAvatarURL({ size: 4096 }),
        guildId: colourGuild,
    });
    const replies = [main];

    const member = interaction.options.getUser('user') ? interaction.options.getMember('user') : interaction.member;
    const serverHash = guildId ? memberImageHash(member, 'avatar') : null;
    if (serverHash) {
        replies.push(
            await imageReply({
                title: t('server_title', { user: user.username }),
                url: memberImageUrl(guildId, user.id, serverHash, 'avatar'),
                guildId: colourGuild,
            })
        );
    }

    return interaction.reply({
        embeds: replies.map((reply) => reply.embed),
        components: replies.map((reply) => reply.row),
    });
}
