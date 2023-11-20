const {
	EmbedBuilder,
	Events,
	Guild,
	AuditLogEvent,
	CommandInteraction,
	Interaction,
	ChannelType,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionsBitField,
} = require('discord.js');
const { FooterText, FooterImage, EmbedColour } = process.env;
const GuildSelectRoles = require('../../../models/GuildSelectRoles.js');
const ticketSetup = require('../../../models/GuildTicketsSetup.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');
const formatResults = require('../../../utils/formatSuggestionResults.js');

module.exports = {
	name: Events.InteractionCreate,
	nickname: 'Suggestions',

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		// deconstructing interaction
		const { guild, client, customId, member, channel, user } = interaction;

		if (!interaction.isStringSelectMenu || !customId) return;
		console.log(`CustomId: ${customId}`);

		try {
			const [type, messageId] = customId.split('.');

			if (!type || !messageId) return;
			if (type !== 'select-role') return;

			await interaction.deferReply({ ephemeral: true });

			const databaseData = await GuildSelectRoles.findOne({
				messageId: messageId,
			});

			if (!databaseData) {
				return await interaction.editReply({
					content: 'This message is not a select role message.',
				});
			}

			const targetChannel =
				guild.channels.cache.get(databaseData.channelId) ||
				(await guild.channels.fetch(databaseData.channelId));

			const targetMessage = await targetChannel.messages.fetch(
				databaseData.messageId
			);

			if (!targetMessage) {
				// delete message from database
				await GuildSelectRoles.findOneAndDelete({
					messageId: messageId,
				});
				return await interaction.editReply({
					content: 'This message is not a select role message.',
				});
			}

			const values = interaction.values;
			console.log(interaction);

			await member.roles.add(values).catch((error) => {
				console.log('Couldnt Add Role');
				return;
			});

			const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

			interaction.editReply({
				content: 'Roles Added',
				ephemeral: true,
			});
		} catch (error) {
			console.log(error);
		}
	},
};
