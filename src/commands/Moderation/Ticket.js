const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
	ChannelType,
	PermissionsBitField,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const GuildTicketsInfo = require('../../models/GuildTicketsInfo.js');
const GuildTicketsSetup = require('../../models/GuildTicketsSetup.js');
const { createTranscript } = require('discord-html-transcripts');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	cooldown: 5,
	catagory: 'Moderation',
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Ticket Actions')
		.setDMPermission(false)

		.addSubcommand((subcommand) =>
			subcommand
				.setName('addmember')
				.setDescription('Add a member to a ticket')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to add')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('removemember')
				.setDescription('Remove a member from a ticket')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to remove')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('delete').setDescription('Delete a ticket')
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('lock').setDescription('Lock a ticket')
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('unlock').setDescription('Unlock a ticket')
		),

	/**
	 *
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Bot permissions
			const botPermissionsArry = [
				'ViewChannel',
				'ManageRoles',
				'ManageChannels',
			];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0]) {
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);
			}

			// User permissions
			const userPermissionsArry = ['BanMembers'];
			const userPermissions = await permissionCheck(
				interaction,
				userPermissionsArry,
				member
			);

			if (!userPermissions[0])
				return await sendEmbed(
					interaction,
					`User Missing Permissions: \`${userPermissions[1]}\``
				);

			await sendEmbed(interaction, 'Getting ticket information');
			await sleep(2000);

			// Variables
			const subcommand = options.getSubcommand();

			const channelTicket = await GuildTicketsInfo.findOne({
				channelid: channel.id,
			});

			if (!channelTicket) {
				return await sendEmbed(interaction, `This is not a ticket channel`);
			}

			const fetchedMember = await guild.members.fetch(channelTicket.memberid);

			switch (subcommand) {
				case 'addmember':
					const targetUserAddMember = options.getUser('member');
					const targetMemberAddMember = await guild.members
						.fetch(targetUserAddMember)
						.catch(() => {
							return false;
						});

					if (!targetMemberAddMember) {
						return await sendEmbed(
							interaction,
							'Please provide a valid user to add to the ticket'
						);
					}

					if (targetMemberAddMember.id === client.user.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove the bot from a ticket'
						);
					}

					if (targetMemberAddMember.id === interaction.member.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove yourself from a ticket'
						);
					}

					if (targetMemberAddMember.manageable === false) {
						return await sendEmbed(
							interaction,
							'I cannot add or remove this user from a ticket'
						);
					}
					const data = GuildTicketsInfo.findOne({
						guildid: guild.id,
						channelid: channel.id,
					});

					if (!data) {
						return await sendEmbed(
							interaction,
							'Please run this command in a ticket channel'
						);
					}

					channel.permissionOverwrites.create(targetMemberAddMember.id, {
						SendMessages: true,
						ViewChannel: true,
						ReadMessageHistory: true,
					});

					await sendEmbed(
						interaction,
						`Added ${targetMemberAddMember} to the ticket`
					);

					break;
				case 'removemember':
					const targetUserRemoveMember = options.getUser('member');
					const targetMemberRemoveMember = await guild.members
						.fetch(targetUserRemoveMember)
						.catch(() => {
							return false;
						});

					if (!targetMemberRemoveMember) {
						return await sendEmbed(
							interaction,
							'Please provide a valid user to add to the ticket'
						);
					}

					if (targetMemberRemoveMember.id === client.user.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove the bot from a ticket'
						);
					}

					if (targetMemberRemoveMember.id === interaction.member.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove yourself from a ticket'
						);
					}

					if (targetMemberRemoveMember.manageable === false) {
						return await sendEmbed(
							interaction,
							'I cannot add or remove this user from a ticket'
						);
					}
					const data2 = GuildTicketsInfo.findOne({
						guildid: guild.id,
						channelid: channel.id,
					});

					if (!data2) {
						return await sendEmbed(
							interaction,
							'Please run this command in a ticket channel'
						);
					}

					channel.permissionOverwrites.create(targetMemberRemoveMember.id, {
						SendMessages: false,
						ViewChannel: false,
						ReadMessageHistory: false,
					});

					await sendEmbed(
						interaction,
						`Removed ${targetMemberRemoveMember} from the ticket`
					);
					break;
				case 'delete':
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
					interaction.editReply({ embeds: [Embed] });

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

					if (fetchedMember) {
						await fetchedMember
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

				case 'lock':
					if (
						!member.permissions.has(PermissionsBitField.Flags.ManageChannels)
					) {
						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription(
								'• You are missing the permission to lock this ticket •'
							)
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						interaction.editReply({ embeds: [Embed], ephemeral: true });
						return;
					}

					if (channelTicket.locked == true) {
						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription('• This ticket is already locked •')
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						interaction.editReply({ embeds: [Embed], ephemeral: true });
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

					await interaction.editReply({ embeds: [LockEmbed] });

					break;

				case 'unlock':
					if (
						!member.permissions.has(PermissionsBitField.Flags.ManageChannels)
					) {
						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription(
								'• You are missing the permission to unlock this ticket •'
							)
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						interaction.editReply({ embeds: [Embed], ephemeral: true });
						return;
					}

					if (channelTicket.locked == false) {
						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription('• This ticket is already unlocked •')
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						interaction.editReply({ embeds: [Embed], ephemeral: true });
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
					await interaction.editReply({ embeds: [UnlockEmbed] });
					break;
			}
		} catch (error) {
			console.error(error);
			await sendErrorEmbed(interaction, error);
			await sendEmbed(
				interaction,
				`There was an error running this command\n\n${error}`
			);
			return;
		}
	},
};
