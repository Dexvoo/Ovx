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
const ticketSchema = require('../../../models/GuildTicketsInfo.js');
const ticketSetup = require('../../../models/GuildTicketsSetup.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');

module.exports = {
	name: Events.InteractionCreate,
	nickname: 'Tickets',

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		if (!interaction.isButton()) return;

		const { guild, client, customId, member } = interaction;
		const { ManageChannels, ViewChannel, SendMessages, ReadMessageHistory } =
			PermissionFlagsBits;

		if (customId !== 'ovx-ticket') return;
		const embed3 = new EmbedBuilder()
			.setColor(EmbedColour)
			.setDescription(`• Creating Ticket •`)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });
		await interaction.reply({ embeds: [embed3], ephemeral: true });

		// bot permissions
		const botPermissionsArry = ['ManageChannels', 'ManageRoles'];
		const botPermissions = await permissionCheck(
			interaction.channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			await sendEmbed(
				interaction.channel,
				`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${interaction.channel}`
			);
			return;
		}

		const ticketId = await ticketSchema.find({ guildid: guild.id }).count();
		console.log(`TicketId: ${ticketId}`);

		const ticketSetupData = await ticketSetup.findOne({ guild: guild.id });

		if (!ticketSetupData) {
			await sendEmbed(
				interaction,
				`Ticket Setup is not set up, please set it up with \`/setup tickets\``
			);
			return;
		}

		// see if user already has a ticket open
		const userTicket = await ticketSchema.findOne({
			guildid: guild.id,
			memberid: member.id,
			closed: false,
		});

		if (userTicket) {
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`• You already have a ticket open •`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });
			interaction.reply({ embeds: [Embed], ephemeral: true });
			return;
		}

		// get @ everyone role
		const everyoneRole = guild.roles.everyone;

		try {
			await guild.channels
				.create({
					name: `${member.user.username}-${ticketId}`,
					reason: `Ticket Created by ${member.user.username}`,
					type: ChannelType.GuildText,
					parent: ticketSetupData.openCategory,
					permissionOverwrites: [
						{
							id: client.user.id,
							allow: [
								PermissionsBitField.Flags.ViewChannel,
								PermissionsBitField.Flags.SendMessages,
								PermissionsBitField.Flags.ReadMessageHistory,
							],
						},
						{
							id: everyoneRole.id,
							deny: [
								PermissionsBitField.Flags.ViewChannel,
								PermissionsBitField.Flags.SendMessages,
								PermissionsBitField.Flags.ReadMessageHistory,
							],
						},
						{
							id: ticketSetupData.modRole,
							allow: [
								PermissionsBitField.Flags.ViewChannel,
								PermissionsBitField.Flags.SendMessages,
								PermissionsBitField.Flags.ReadMessageHistory,
							],
						},
						{
							id: ticketSetupData.adminRole,
							allow: [
								PermissionsBitField.Flags.ViewChannel,
								PermissionsBitField.Flags.SendMessages,
								PermissionsBitField.Flags.ReadMessageHistory,
							],
						},
						{
							id: member.id,
							allow: [
								PermissionsBitField.Flags.ViewChannel,
								PermissionsBitField.Flags.SendMessages,
								PermissionsBitField.Flags.ReadMessageHistory,
							],
						},
					],
				})
				.then(async (channel) => {
					const newTicketSchema = await ticketSchema.create({
						guildid: guild.id,
						memberid: member.id,
						ticketid: ticketId,
						channelid: channel.id,
						closed: false,
						locked: false,
					});

					const embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`${guild.name} - Ticket: ${ticketId}`)
						.setDescription(
							'• Our team will contact you shortly, Please discribe your issue •'
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					const Button = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId('ovx-ticket-close')
							.setLabel('Close Ticket')
							.setStyle(ButtonStyle.Primary)
							.setEmoji('❌'),
						new ButtonBuilder()
							.setCustomId('ovx-ticket-lock')
							.setLabel('Lock Ticket')
							.setStyle(ButtonStyle.Secondary)
							.setEmoji('🔐'),
						new ButtonBuilder()
							.setCustomId('ovx-ticket-unlock')
							.setLabel('Unlock Ticket')
							.setStyle(ButtonStyle.Success)
							.setEmoji('🔓')
					);

					await channel.send({
						content: `${member}`,
						embeds: [embed],
						components: [Button],
					});

					const embed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`• Ticket Created : ${channel} •`)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					await interaction.editReply({ embeds: [embed2], ephemeral: true });
				})
				.catch(async (error) => {
					console.error(error);
					await sendEmbed(interaction, error);
				});
		} catch (error) {}
	},
};
