const { SlashCommandBuilder, Colors, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits } = require('discord.js');
const InviteDetectionCache = require('../../cache/InviteDetection');

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    data: new SlashCommandBuilder()
        .setName('invitedetection')
        .setDescription('Enable or disable automatic deletion of server invites.')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Set to true to enable, false to disable.')
                .setRequired(true)
        ),

    /**
    * @param {import('../../types').CommandInputUtils} interaction
    */

    async execute(interaction) {
        const { options, guild, client } = interaction;
        const enabled = options.getBoolean('enabled');

        const config = await InviteDetectionCache.get(guild.id);

        if (config.enabled === enabled) {
            return client.utils.Embed(interaction, Colors.Blurple, 'Invite Detection', `Invite detection is already **${enabled ? 'enabled' : 'disabled'}**.`);
        }

        await InviteDetectionCache.set(guild.id, { enabled });

        client.utils.Embed(interaction, Colors.Blurple, 'Invite Detection', `Successfully **${enabled ? 'enabled' : 'disabled'}** invite detection.`);
    }
};