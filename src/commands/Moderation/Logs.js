const { SlashCommandBuilder, Colors, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction } = require('discord.js');
const { SendEmbed } = require('../../utils/LoggingData')

const logChoices = [
    { name: 'Message', value: 'message' },
    { name: 'Channel', value: 'channel' },
    { name: 'Member', value: 'member' },
    { name: 'Member Join', value: 'join' },
    { name: 'Member Leave', value: 'leave' },
    { name: 'Voice', value: 'voice' },
    { name: 'Role', value: 'role' },
    { name: 'Server', value: 'server' },
    { name: 'Punishment', value: 'punishment' },
    { name: 'ALL Logs', value: 'all' }
];

const handlers = {
    'ovx-logs-setup': require('../../handlers/Logs/Setup'),
    'ovx-logs-view': require('../../handlers/Logs/View'),
    'ovx-logs-test': require('../../handlers/Logs/Test')
};

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Manage guild logs')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        
        .addSubcommand(subcommand => subcommand
            .setName('setup')
            .setDescription('Setup logging for your server.')
            .addStringOption(option => option
                .setName('log-type')
                .setDescription('Type of log to setup')
                .setRequired(true)
                .addChoices(logChoices)
            )
            .addBooleanOption(option => option
                .setName('enabled')
                .setDescription('Enable or disable the log type')
                .setRequired(true)
            )

            .addChannelOption(option => option
                .setName('channel')
                .setDescription('The channel to send the logs to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('view')
            .setDescription('View the current logging setup for your server.')
            .addStringOption(option => option
                .setName('log-type')
                .setDescription('Type of log to view')
                .setRequired(true)
                .addChoices(logChoices)
            )
        )

        .addSubcommand(subcommand => subcommand
            .setName('test')
            .setDescription('Test the logging setup for your server.')
            .addStringOption(option => option
                .setName('log-type')
                .setDescription('Type of log to test')
                .setRequired(true)
                .addChoices(logChoices)
            )
        ),
    /**
    * @param {ChatInputCommandInteraction} interaction
    */

    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();
        if(!handlers[`ovx-logs-${subcommand}`]) return SendEmbed(interaction, Colors.Red, 'Logs | Not Found', `The subcommand \`${subcommand}\` does not exist.`);

        const handler = handlers[`ovx-logs-${subcommand}`];

        try {
            await handler(interaction);
        } catch (error) {
            console.error(error);
            SendEmbed(interaction, Colors.Red, 'Logs | Error', `There was an error while executing this command: \`${error.message}\``);
        }
    }
};