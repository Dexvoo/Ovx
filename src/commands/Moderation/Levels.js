const {
  SlashCommandBuilder,
  Colors,
  InteractionContextType,
  ApplicationIntegrationType,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const LevelCache = require('../../cache/Levels');

const handlers = {
  setup: require('../../handlers/Levels/Setup'),
  rank: require('../../handlers/Levels/Rank'),
  leaderboard: require('../../handlers/Levels/Leaderboard'),
  settings: {
    'xp-multiplier': require('../../handlers/Levels/Settings/XPMultiplier'),
    'message-cooldown': require('../../handlers/Levels/Settings/MessageCooldown'),
    'max-level': require('../../handlers/Levels/Settings/MaxLevel'),
    'levelup-message': require('../../handlers/Levels/Settings/LevelupMessage'),
    'remove-past-rewards': require('../../handlers/Levels/Settings/RewardsRemovePast'),
    'add-reward': require('../../handlers/Levels/Settings/RewardAdd'),
    'remove-reward': require('../../handlers/Levels/Settings/RewardRemove'),
    'view-rewards': require('../../handlers/Levels/Settings/RewardsList'),
    blacklist: require('../../handlers/Levels/Settings/Blacklist'),
    'add-multiplier': require('../../handlers/Levels/Settings/RoleMultiplierAdd'),
    'remove-multiplier': require('../../handlers/Levels/Settings/RoleMultiplierRemove'),
    'view-multipliers': require('../../handlers/Levels/Settings/RoleMultiplierList'),
  },
  admin: {
    set: require('../../handlers/Levels/Admin/Set'),
    add: require('../../handlers/Levels/Admin/Add'),
    remove: require('../../handlers/Levels/Admin/Remove'),
  },
};

module.exports = {
  cooldown: 0,
  category: 'Levels',
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Leveling system commands for ranks, leaderboards, and settings.')
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .setContexts([InteractionContextType.Guild])
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rank')
        .setDescription("Shows your or another user's current level and XP.")
        .addUserOption((option) =>
          option.setName('user').setDescription('The user you want to check.').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('leaderboard')
        .setDescription('Displays the server leaderboard.')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('The type of leaderboard to show.')
            .setRequired(true)
            .addChoices(
              { name: 'Levels', value: 'level' },
              { name: 'Messages', value: 'messages' },
              { name: 'Voice', value: 'voice' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Enable or disable the leveling system for your server.')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable the level system.')
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName('levelup-channel')
            .setDescription('Channel to send level-up messages.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('settings')
        .setDescription('Configure leveling system settings.')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('xp-multiplier')
            .setDescription("Set the server's XP multiplier (Max: 5).")
            .addNumberOption((option) =>
              option
                .setName('multiplier')
                .setDescription('Value from 0 to 5 (e.g., 2 for double XP).')
                .setMinValue(0)
                .setMaxValue(5)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('message-cooldown')
            .setDescription('Set the cooldown between XP gains in seconds.')
            .addIntegerOption((option) =>
              option
                .setName('seconds')
                .setDescription('Cooldown in seconds (20-3600).')
                .setMinValue(20)
                .setMaxValue(3600)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('max-level')
            .setDescription('Set the maximum level users can reach.')
            .addIntegerOption((option) =>
              option
                .setName('level')
                .setDescription('Maximum level (1-10000).')
                .setMinValue(1)
                .setMaxValue(10000)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('levelup-message')
            .setDescription('Set the custom level-up message.')
            .addStringOption((option) =>
              option
                .setName('message')
                .setDescription('Use {user} and {level} as placeholders.')
                .setMinLength(1)
                .setMaxLength(500)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove-past-rewards')
            .setDescription("Set whether to remove a user's previous level-up role.")
            .addBooleanOption((option) =>
              option
                .setName('enabled')
                .setDescription('True to remove old roles, false to keep them.')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add-reward')
            .setDescription('Add a role reward for reaching a certain level.')
            .addIntegerOption((option) =>
              option
                .setName('level')
                .setDescription('The level required to get the role.')
                .setMinValue(1)
                .setMaxValue(10000)
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option
                .setName('role')
                .setDescription('The role to give at that level.')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove-reward')
            .setDescription('Remove a level reward.')
            .addIntegerOption((option) =>
              option
                .setName('level')
                .setDescription('The level whose reward you want to remove.')
                .setMinValue(1)
                .setMaxValue(10000)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('view-rewards')
            .setDescription('List all configured level reward roles.')
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('blacklist')
            .setDescription('Blacklist roles or channels from gaining XP.')
            .addRoleOption((option) =>
              option
                .setName('role')
                .setDescription('Role to blacklist from gaining XP.')
                .setRequired(false)
            )
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('Channel to blacklist from gaining XP.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add-multiplier')
            .setDescription('Add an XP multiplier to a role.')
            .addRoleOption((option) =>
              option.setName('role').setDescription('The role to grant bonus XP.').setRequired(true)
            )
            .addNumberOption((option) =>
              option
                .setName('multiplier')
                .setDescription('The multiplier (e.g., 1.5 for +50% XP).')
                .setMinValue(1.01)
                .setMaxValue(5)
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove-multiplier')
            .setDescription('Remove an XP multiplier from a role.')
            .addRoleOption((option) =>
              option
                .setName('role')
                .setDescription('The role to remove the multiplier from.')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('view-multipliers')
            .setDescription('View all configured role XP multipliers.')
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('admin')
        .setDescription('Admin commands to manage user levels and XP.')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('set')
            .setDescription("Set a user's level or XP to a specific value.")
            .addUserOption((option) =>
              option.setName('user').setDescription('The user to modify.').setRequired(true)
            )
            .addIntegerOption((option) =>
              option.setName('level').setDescription('The exact level to set.').setMinValue(0)
            )
            .addIntegerOption((option) =>
              option
                .setName('xp')
                .setDescription("The exact amount of XP to set for the user's current level.")
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setDescription("Add levels or XP to a user's current total.")
            .addUserOption((option) =>
              option.setName('user').setDescription('The user to modify.').setRequired(true)
            )
            .addIntegerOption((option) =>
              option.setName('levels').setDescription('The number of levels to add.')
            )
            .addIntegerOption((option) =>
              option.setName('xp').setDescription('The amount of XP to add.')
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove')
            .setDescription("Remove levels or XP from a user's current total.")
            .addUserOption((option) =>
              option.setName('user').setDescription('The user to modify.').setRequired(true)
            )
            .addIntegerOption((option) =>
              option.setName('levels').setDescription('The number of levels to remove.')
            )
            .addIntegerOption((option) =>
              option.setName('xp').setDescription('The amount of XP to remove.')
            )
        )
    ),

  /**
   * @param {import('../../types').CommandInputUtils} interaction
   */

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const handler = subcommandGroup
      ? handlers[subcommandGroup]?.[subcommand]
      : handlers[subcommand];

    if (!handler) {
      return interaction.client.utils.Embed(
        interaction,
        Colors.Red,
        'Error',
        `Command handler not found.`
      );
    }

    try {
      const LevelConfigData = await LevelCache.get(interaction.guildId);
      await handler(interaction, { LevelConfigData });
    } catch (error) {
      console.error(`Error executing level command '${subcommand}':`, error);
      interaction.client.utils.Embed(
        interaction,
        Colors.Red,
        'Error',
        `An unexpected error occurred: \`${error.message}\``
      );
    }
  },
};
