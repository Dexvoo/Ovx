const { SlashCommandBuilder, Colors, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, GuildMember, Client, User, MessageFlags } = require('discord.js');
const InviteDetectionCache = require('../../cache/InviteDetection');
const { InviteDetectionConfig } = require('../../models/GuildSetups');

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('invitedetection')
        .setDescription('Setup invite detection so invites get automatically deleted.')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        
        .addBooleanOption(option => option
            .setName('enabled')
            .setDescription('Enable or disable Invite Detection')
            .setRequired(true)
        ),
    /**
    * @param {import('../../types').CommandInputUtils} interaction
    */

    async execute(interaction) {
        const { options, guild, client, member } = interaction;
        const enabled = options.getBoolean('enabled');

        const InviteDetectionData = await InviteDetectionCache.get(guild.id);

        if(InviteDetectionData.enabled && enabled) return client.utils.Embed(interaction, Colors.Blurple, 'Invite Detection', 'Already Enabled');
        if(!InviteDetectionData.enabled && !enabled) return client.utils.Embed(interaction, Colors.Blurple, 'Invite Detection', 'Already Disabled');
        console.log(enabled)

        await InviteDetectionCache.set(guild.id, { enabled: enabled });

        client.utils.Embed(interaction, Colors.Blurple, 'Invite Detection', `Successfully ${enabled ? 'Enabled' : 'Disabled'} Invite Detection`); 
    }
};