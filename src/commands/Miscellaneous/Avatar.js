const {
  SlashCommandBuilder,
  Colors,
  InteractionContextType,
  ApplicationIntegrationType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ImageFormat,
} = require('discord.js');

module.exports = {
  cooldown: 3,
  category: 'Miscellaneous',
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Displays a user's avatar or the server icon.")
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ])
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose avatar you want to see.')
        .setRequired(false)
    ),
  /**
   * @param {import('../../types').CommandInputUtils} interaction
   */
  async execute(interaction) {
    const { client, guild, options } = interaction;
    const user = options.getUser('user');

    if (user) {
      // User Avatar Logic
      const targetUser = await client.users.fetch(user.id, { force: true });
      const avatarURL = targetUser.displayAvatarURL({ dynamic: true, size: 512 });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('PNG')
          .setURL(targetUser.displayAvatarURL({ format: ImageFormat.PNG, size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('JPG')
          .setURL(targetUser.displayAvatarURL({ format: ImageFormat.JPEG, size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('GIF')
          .setURL(targetUser.displayAvatarURL({ format: ImageFormat.GIF, size: 1024 }))
      );

      const Embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${targetUser.username}'s Avatar`)
        .setImage(avatarURL);

      await interaction.reply({ embeds: [Embed], components: [row] });
    } else {
      // Guild Icon Logic
      if (!guild)
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Error',
          'This command must be used in a server to get the server icon.'
        );

      const iconURL = guild.iconURL({ dynamic: true, size: 512 });
      if (!iconURL)
        return client.utils.Embed(
          interaction,
          Colors.Orange,
          'No Icon',
          'This server does not have an icon.'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('PNG')
          .setURL(guild.iconURL({ format: 'png', size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('JPG')
          .setURL(guild.iconURL({ format: 'jpg', size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('WEBP')
          .setURL(guild.iconURL({ format: 'webp', size: 1024 }))
      );

      const Embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${guild.name}'s Server Icon`)
        .setImage(iconURL);

      await interaction.reply({ embeds: [Embed], components: [row] });
    }
  },
};
