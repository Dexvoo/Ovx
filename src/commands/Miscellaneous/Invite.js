const {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  ApplicationIntegrationType,
} = require('discord.js');

const supportServerUrl = process.env.SupportServerUrl || 'https://discord.com';

module.exports = {
  cooldown: 5,
  category: 'Miscellaneous',
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Provides invite links for the bot and its support server.')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  async execute(interaction) {
    const { client } = interaction;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Support Server')
        .setURL(supportServerUrl),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Install App')
        .setURL(
          `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot%20applications.commands`
        )
        .setDisabled(process.env.DeveloperMode === 'true')
    );

    const inviteEmbed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle('Invite Me!')
      .setDescription(
        'Need help? Join our support server! You can also add me to your own server or install for your user account.'
      );

    await interaction.reply({ embeds: [inviteEmbed], components: [row] });
  },
};
