import {
    SlashCommandBuilder,
    MessageFlags,
    ApplicationIntegrationType,
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { ENV } from '../../../bootstrap/environment.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('dashboard');
commandData.setDescription("Open Ovx's settings for this server on the dashboard.");
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * Settings are changed on the dashboard, so this links straight to this server's page there.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, locale, guildId } = interaction;
    const t = (key) => client.utils.Translate(`commands.dashboard.${key}`, locale);

    if (!ENV.DASHBOARD) {
        return client.utils.Embed(interaction, 'Red', client.utils.Translate('errors.title', locale), t('offline'), {
            flags: MessageFlags.Ephemeral,
        });
    }

    const button = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(t('button'))
        .setURL(`${ENV.DASHBOARD.URL}/servers/${guildId}`);

    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(button);
    return client.utils.Embed(interaction, 'Brand', t('title'), t('description'), {
        components: [row],
        flags: MessageFlags.Ephemeral,
    });
}
