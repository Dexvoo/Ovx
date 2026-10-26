import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { inviteUrl, userInstallUrl, SUPPORT_URL } from '../../../shared/utils/invite.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { ENV } from '../../../bootstrap/environment.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('invite');
commandData.setDescription('Add Ovx to a server, or to your account for DMs.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client, locale } = interaction;
    const t = (key) => client.utils.Translate(`commands.invite.${key}`, locale);

    const embed = new EmbedBuilder()
        .setColor(await brandColour(interaction.inCachedGuild() ? interaction.guildId : null))
        .setTitle(t('title'))
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
        .setDescription([t('server'), t('account'), '', t('dashboard')].join('\n'));

    const links = [
        [t('add_server'), inviteUrl(ENV.APPLICATION_ID)],
        [t('add_account'), userInstallUrl(ENV.APPLICATION_ID)],
        ENV.DASHBOARD && [t('open_dashboard'), ENV.DASHBOARD.URL],
        [t('support'), SUPPORT_URL],
    ].filter(Boolean);
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        links.map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url))
    );
    return interaction.reply({ embeds: [embed], components: [row] });
}
