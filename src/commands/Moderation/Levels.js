const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, GuildMember, Client, User, MessageFlags, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChatInputCommandInteraction, PermissionsBitField } = require('discord.js');
const { SendEmbed, consoleLogData, ShortTimestamp } = require('../../utils/LoggingData')
require('dotenv').config();
const ms = require('ms');
const { DeveloperIDs } = process.env;
const { TicketConfig, TicketInstance } = require('../../models/GuildSetups');
const { permissionCheck } = require('../../utils/Permissions');

const handlers = {
    setup: require('../../handlers/Levels/Setup'),
    settings: {
        'xp-multiplier': require('../../handlers/Levels/Settings/XPMultiplier'),
        'message-cooldown': require('../../handlers/Levels/Settings/MessageCooldown'),
        'max-level': require('../../handlers/Levels/Settings/MaxLevel'),
        'levelup-message': require('../../handlers/Levels/Settings/LevelupMessage'),
        'remove-past-rewards': require('../../handlers/Levels/Settings/RewardsRemovePast'),
        'add-reward': require('../../handlers/Levels/Settings/RewardAdd'),
        'remove-reward': require('../../handlers/Levels/Settings/RewardRemove'),
        'list-rewards': require('../../handlers/Levels/Settings/RewardsList'),
    },
};

const LevelCache = require('../../cache/Levels');

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Get/enable level stats of a user/leaderboard')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )

        .addSubcommand(subcommand => subcommand
            .setName('rank')
            .setDescription('Shows your current level and XP in the guild')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user you want to check')
                .setRequired(false)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('setup')
            .setDescription('Setup level system for your server.')
            .addBooleanOption(option => option
                .setName('enabled')
                .setDescription('Enable or disable level system.')
                .setRequired(true)
            )
            .addChannelOption(option => option
                .setName('setup-channel')
                .setDescription('Channel to send level-up messages.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )

        .addSubcommandGroup(group => group
            .setName('settings')
            .setDescription('Edit level system settings.')
    
            // XP Multiplier
            .addSubcommand(subcommand => subcommand
                .setName('xp-multiplier')
                .setDescription('Set the XP multiplier for this server.')
                .addNumberOption(option => option
                    .setName('multiplier')
                    .setDescription('Multiplier value (e.g. 1 = normal, 2 = double XP)')
                    .setMinValue(0)
                    .setMaxValue(100)
                    .setRequired(true)
                )
            )
        
            // Message Cooldown
            .addSubcommand(subcommand => subcommand
                .setName('message-cooldown')
                .setDescription('Set cooldown between XP gains in seconds.')
                .addIntegerOption(option => option
                    .setName('cooldown')
                    .setDescription('Cooldown in seconds (e.g. 60 = 1 minute).')
                    .setMinValue(20)
                    .setMaxValue(3600)
                    .setRequired(true)
                )
            )
        
            // Max Level
            .addSubcommand(subcommand => subcommand
                .setName('max-level')
                .setDescription('Set the maximum level users can reach.')
                .addIntegerOption(option => option
                    .setName('level')
                    .setDescription('Maximum level (e.g. 100).')
                    .setMinValue(1)
                    .setMaxValue(10000)
                    .setRequired(true)
                )
            )
        
            // Level-Up Message
            .addSubcommand(subcommand => subcommand
                .setName('levelup-message')
                .setDescription('Set the custom level-up message.')
                .addStringOption(option => option
                    .setName('message')
                    .setDescription('Custom message. Use {user} and {level} as placeholders.')
                    .setMinLength(1)
                    .setMaxLength(500)
                    .setRequired(true)
                )
            )
        
            // Remove Past Rewards
            .addSubcommand(subcommand => subcommand
                .setName('remove-past-rewards')
                .setDescription('Set whether to remove past level reward roles.')
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('True to remove old roles, (default: false) false to keep them.')
                    .setRequired(true)
                )
            )

            // Level Reward - Add
            .addSubcommand(subcommand => subcommand
                .setName('add-reward')
                .setDescription('Add a level reward.')
                .addIntegerOption(option => option
                    .setName('level')
                    .setDescription('The level users must reach to get the role.')
                    .setMinValue(1)
                    .setMaxValue(10000)
                    .setRequired(true)
                )
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('The role to give at that level.')
                    .setRequired(true)
                )
            )
        
            // Level Reward - Remove
            .addSubcommand(subcommand => subcommand
                .setName('remove-reward')
                .setDescription('Remove a level reward.')
                .addIntegerOption(option => option
                    .setName('level')
                    .setDescription('The level you want to remove the reward for.')
                    .setMinValue(1)
                    .setMaxValue(10000)
                    .setRequired(false)
                )
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('The role you want to remove the reward for.')
                    .setRequired(false)
                )
            )
        
            // Level Reward - List
            .addSubcommand(subcommand => subcommand
                .setName('list-rewards')
                .setDescription('List all level reward roles.')
            )
        ),
    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false); // false = not required
        const subcommand = interaction.options.getSubcommand();
        let handler;
        if (subcommandGroup) {
            handler = handlers[subcommandGroup]?.[subcommand];
        } else {
            handler = handlers[subcommand];
        }

        if (!handler) {
            return SendEmbed(interaction, Colors.Red, 'Level | Not Found', `Handler for \`${subcommandGroup ? `${subcommandGroup} ${subcommand}` : subcommand}\` not found.`);
        }

        try {
            const { guild } = interaction;
            const LevelConfigData = await LevelCache.get(guild.id);

            const context = {
                LevelConfigData,
            };

            await handler(interaction, context);
        } catch (error) {
            console.error(error);
            SendEmbed(interaction, Colors.Red, 'Level | Error', `Error: \`${error.message}\``);
        }
    }
};