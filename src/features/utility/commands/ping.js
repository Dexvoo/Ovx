import { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } from 'discord.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('ping');
commandData.setDescription('Replies with Pong!');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);
commandData.setDMPermission(true);

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { locale, createdTimestamp, client } = interaction;
    const ms = Date.now() - createdTimestamp;
    const api = Math.round(client.ws.ping);
    const title = client.utils.Translate('commands.ping.title', locale);
    const description = client.utils.Translate('commands.ping.description', locale, { ms, api });

    client.utils.Embed(interaction, 'Brand', title, description, { flags: MessageFlags.Ephemeral });
}
