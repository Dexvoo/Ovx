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
    .setName('banner')
    .setDescription("Displays a user's banner or the server banner.")
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
        .setDescription('The user whose banner you want to see.')
        .setRequired(false)
    ),
  /**
   * @param {import('../../types').CommandInputUtils} interaction
   */
  async execute(interaction) {
    const { client, guild, options } = interaction;
    const user = options.getUser('user');

    if (user) {
      // User Banner Logic
      const targetUser = await client.users.fetch(user.id, { force: true }); // Banners require a force fetch
      const bannerURL = targetUser.bannerURL({ dynamic: true, size: 512 });

      if (!bannerURL)
        return client.utils.Embed(
          interaction,
          Colors.Orange,
          'No Banner',
          `${targetUser.username} does not have a banner.`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('PNG')
          .setURL(targetUser.bannerURL({ format: ImageFormat.PNG, size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('JPG')
          .setURL(targetUser.bannerURL({ format: ImageFormat.JPEG, size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('GIF')
          .setURL(targetUser.bannerURL({ format: ImageFormat.GIF, size: 1024 }))
      );

      const Embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${targetUser.username}'s Banner`)
        .setImage(bannerURL);

      await interaction.reply({ embeds: [Embed], components: [row] });
    } else {
      // Guild Banner Logic
      if (!guild)
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Error',
          'This command must be used in a server to get the server banner.'
        );

      const bannerURL = guild.bannerURL({ size: 512 });
      if (!bannerURL)
        return client.utils.Embed(
          interaction,
          Colors.Orange,
          'No Banner',
          'This server does not have a banner.'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('PNG')
          .setURL(guild.bannerURL({ format: ImageFormat.PNG, size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('JPG')
          .setURL(guild.bannerURL({ format: ImageFormat.JPEG, size: 1024 })),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('WEBP')
          .setURL(guild.bannerURL({ format: ImageFormat.WebP, size: 1024 }))
      );

      const Embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${guild.name}'s Server Banner`)
        .setImage(bannerURL);

      await interaction.reply({ embeds: [Embed], components: [row] });
    }
  },
};
