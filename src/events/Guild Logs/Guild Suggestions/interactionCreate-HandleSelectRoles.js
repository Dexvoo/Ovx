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

			var addedOrRemoved;
			var addedRoles = [];
			var removedRoles = [];

			for (const value of values) {
				const role =
					guild.roles.cache.get(value) || (await guild.roles.fetch(value));

				if (!role) {
					continue;
				}

				if (member.roles.cache.has(role.id)) {
					await member.roles.remove(role.id);
					addedOrRemoved = 'Removed';
					removedRoles.push(`<@&${role.id}>`);
				} else {
					await member.roles.add(role.id);
					addedOrRemoved = 'Added';
					addedRoles.push(`<@&${role.id}>`);
				}
			}

			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.addFields(
					{
						name: `Added Roles`,
						value: `${addedRoles.join(', ') || 'None'}`,
						inline: true,
					},
					{
						name: `Removed Roles`,
						value: `${removedRoles.join(', ') || 'None'}`,
						inline: true,
					}
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			await interaction.editReply({ embeds: [Embed] });
		} catch (error) {
			console.log(error);
		}
	},
};
