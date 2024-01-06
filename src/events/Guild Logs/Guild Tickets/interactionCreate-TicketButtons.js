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
const GuildTicketsInfo = require('../../../models/GuildTicketsInfo.js');
const GuildTicketsSetup = require('../../../models/GuildTicketsSetup.js');
const { createTranscript } = require('discord-html-transcripts');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');

module.exports = {
	name: Events.InteractionCreate,
	nickname: 'Tickets',
	once: false,

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		if (!interaction.isButton()) return;

		const { guild, client, customId, member, channel } = interaction;

		if (
			!['ovx-ticket-close', 'ovx-ticket-lock', 'ovx-ticket-unlock'].includes(
				customId
			)
		) {
			return;
		}

		// bot permissions
		const botPermissionsArry = ['ManageChannels'];
		const botPermissions = await permissionCheck(
			interaction.channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			await sendEmbed(
				interaction,
				`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${interaction.channel}`
			);
			return;
		}

		const channelTicket = await GuildTicketsInfo.findOne({
			channelid: channel.id,
		});

		if (!channelTicket) {
			return await sendEmbed(interaction, `Something went wrong :/`);
		}

		const fetchedMember = await guild.members.fetch(channelTicket.memberid);

		switch (customId) {
			case 'ovx-ticket-close':
				if (channelTicket.closed == true) {
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription('• This ticket is already getting deleted •')
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					interaction.reply({ embeds: [Embed], ephemeral: true });
					return;
				}
				const Embed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription('• Closing ticket •')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				interaction.reply({ embeds: [Embed] });

				const transcript = await createTranscript(channel, {
					limit: -1,
					returnBuffer: false,
					filename: `${member.user.username}-ticket-${channelTicket.ticketid}.html`,
				});
				await GuildTicketsInfo.updateOne(
					{
						channelid: channel.id,
					},
					{
						closed: true,
					}
				);
				const transcriptEmbed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setTitle(
						`Ticket ID: ${channelTicket.ticketid} - Member: ${fetchedMember.id}`
					)
					.setFooter({ text: FooterText, iconURL: FooterImage })
					.setTimestamp();

				const TranscriptProcess = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription(
						"• This ticket will be closed in 10 seconds, enable DM's for the ticket transcript •"
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });

				const ticketData = await GuildTicketsSetup.findOne({
					guild: guild.id,
				});

				const targetMember = await guild.members.fetch(channelTicket.memberid);

				if (targetMember) {
					await targetMember
						.send({
							embeds: [transcriptEmbed],
							files: [transcript],
						})
						.catch(async () => {
							const couldntSendEmbed = new EmbedBuilder()
								.setColor(EmbedColour)
								.setDescription('• Could not send the transcript to member •')
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });
							await channel.send({ embeds: [couldntSendEmbed] });
						});
				}

				const TranscriptChannel = guild.channels.cache.get(
					ticketData.archiveChannel
				);

				if (TranscriptChannel) {
					// bot permissions
					const botPermissionsArry = [
						'SendMessages',
						'AttachFiles',
						'ViewChannel',
					];
					const botPermissions = await permissionCheck(
						TranscriptChannel,
						botPermissionsArry,
						client
					);

					if (botPermissions[0]) {
						await TranscriptChannel.send({
							embeds: [transcriptEmbed],
							files: [transcript],
						}).catch(async (error) => {
							console.log(error);
						});
					}
				} else {
					const couldntSendEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(
							'• Could not send the transcript to archive channel •'
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await channel.send({ embeds: [couldntSendEmbed] });
				}

				interaction.editReply({ embeds: [TranscriptProcess] });

				setTimeout(function () {
					channel.delete();
				}, 10000);

				break;

			case 'ovx-ticket-lock':
				if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(
							'• You are missing the permission to lock this ticket •'
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					interaction.reply({ embeds: [Embed], ephemeral: true });
					return;
				}

				if (channelTicket.locked == true) {
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription('• This ticket is already locked •')
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					interaction.reply({ embeds: [Embed], ephemeral: true });
					return;
				}

				await GuildTicketsInfo.updateOne(
					{ channelid: channel.id },
					{ locked: true }
				);

				const LockEmbed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription('• This ticket is now locked 🔐 •')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });

				await interaction.channel.permissionOverwrites
					.edit(fetchedMember.user, {
						SendMessages: false,
					})
					.catch(async (error) => {
						console.log(error);
					});

				return interaction.reply({ embeds: [LockEmbed] });

			case 'ovx-ticket-unlock':
				// bot permissions
				const botPermissionsArry = ['ManageChannels'];
				const botPermissions = await permissionCheck(
					interaction.channel,
					botPermissionsArry,
					client
				);

				if (!botPermissions[0]) {
					await sendEmbed(
						interaction,
						`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${interaction.channel}`
					);
					return;
				}

				if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(
							'• You are missing the permission to unlock this ticket •'
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					interaction.reply({ embeds: [Embed], ephemeral: true });
					return;
				}

				if (channelTicket.locked == false) {
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription('• This ticket is already unlocked •')
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					interaction.reply({ embeds: [Embed], ephemeral: true });
					return;
				}

				await GuildTicketsInfo.updateOne(
					{ channelid: channel.id },
					{ locked: false }
				);

				const UnlockEmbed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription('• This ticket is now unlocked 🔓 •')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });

				await interaction.channel.permissionOverwrites
					.edit(fetchedMember.user, {
						SendMessages: true,
					})
					.catch(async (error) => {
						console.log(error);
					});

				// edit permissions of the channel
				return interaction.reply({ embeds: [UnlockEmbed] });
		}
	},
};
