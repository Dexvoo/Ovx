import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, MessageFlags } from 'discord.js';
import { createSuggestion, CONTENT_MAX } from '../utils/actions.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('suggest');
commandData.setDescription('Suggest something for this server. Everyone can vote on it.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addStringOption((option) =>
    option.setName('idea').setDescription('Your suggestion.').setRequired(true).setMaxLength(CONTENT_MAX)
);
commandData.addAttachmentOption((option) => option.setName('image').setDescription('An image to go with it.'));

export const meta = {
    cooldown: 10,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, locale, options } = interaction;
    const t = (key, vars) => client.utils.Translate(`suggestions.${key}`, locale, vars);
    const image = options.getAttachment('image');
    if (image && !image.contentType?.startsWith('image/')) {
        return interaction.reply({ content: t('errors.not_image'), flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await createSuggestion(interaction.member, {
        content: options.getString('idea', true),
        imageUrl: image?.url ?? null,
    });
    if (!result.ok) return interaction.editReply({ content: t(`errors.${result.error}`, result.vars) });

    const { suggestion } = result;
    const link = `https://discord.com/channels/${interaction.guildId}/${suggestion.channelId}/${suggestion.messageId}`;
    return interaction.editReply({ content: t('posted', { number: suggestion.number, link }) });
}
