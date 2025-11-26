const {
  SlashCommandBuilder,
  Colors,
  InteractionContextType,
  ApplicationIntegrationType,
} = require('discord.js');

const handlers = {
  user: require('../../handlers/Information/User'),
  channel: require('../../handlers/Information/Channel'),
  role: require('../../handlers/Information/Role'),
  guild: require('../../handlers/Information/Guild'),
  bot: require('../../handlers/Information/Bot'),
};

module.exports = {
  cooldown: 5,
  category: 'Miscellaneous',
  data: new SlashCommandBuilder()
    .setName('information')
    .setDescription('Get detailed information about a user, channel, role, or the server.')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ])
    .addSubcommand((subcommand) =>
      subcommand
        .setName('user')
        .setDescription('Get information about a server member.')
        .addUserOption((option) =>
          option
            .setName('target')
            .setDescription('The user to get info about (defaults to you).')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Get information about a channel.')
        .addChannelOption((option) =>
          option
            .setName('target')
            .setDescription('The channel to get info about (defaults to current).')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('role')
        .setDescription('Get information about a role.')
        .addRoleOption((option) =>
          option.setName('target').setDescription('The role to get info about.').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('guild').setDescription('Get information about the current server.')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('bot').setDescription('Get information about me!')
    ),

  /**
   * @param {import('../../types').CommandInputUtils} interaction
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const handler = handlers[subcommand];

    if (!handler) {
      return interaction.client.utils.Embed(
        interaction,
        Colors.Red,
        'Error',
        `Subcommand handler for '${subcommand}' not found.`
      );
    }

    try {
      await handler(interaction);
    } catch (error) {
      console.error(`Error executing info subcommand '${subcommand}':`, error);
      interaction.client.utils.Embed(
        interaction,
        Colors.Red,
        'Error',
        `An unexpected error occurred: \`${error.message}\``
      );
    }
  },
};
