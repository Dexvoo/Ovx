const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const { s } = require('@sapphire/shapeshift');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('moderation')
		.setDescription('List of Moderation commands.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('ban')
				.setDescription('Banish a specified user from a guild.')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('Member to ban')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('userid')
						.setDescription('Userid to ban')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for ban')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('unban')
				.setDescription('Unban a specified user from a guild.')
				.addStringOption((option) =>
					option
						.setName('userid')
						.setDescription('The specified userid to unban.')
						.setRequired(true)
				)
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

			var botPermissionsArry;
			var userPermissionsArry;
			console.log(options.getSubcommand() === 'unban');
			switch (options.getSubcommand()) {
				case 'ban':
					botPermissionsArry = ['BanMembers'];
					userPermissionsArry = ['BanMembers'];
					break;
				case 'unban':
					botPermissionsArry = ['BanMembers'];
					userPermissionsArry = ['BanMembers'];
			}

			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0])
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);

			// User permissions
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

			await sendEmbed(interaction, 'Attempting carry out moderation command');
			await sleep(2000);

			switch (options.getSubcommand()) {
				case 'ban':
					// Variables
					var targetMember = options.getMember('member');
					const targetUseridBan = options.getString('userid');
					var reason = options.getString('reason');
					var auditLogsReason;

					if (!targetMember && !targetUseridBan)
						return await sendEmbed(interaction, 'Please specify a user to ban');

					if (!targetMember && targetUseridBan) {
						targetMember =
							guild.members.cache.get(targetUseridBan) ||
							(await client.users.fetch(targetUseridBan).catch(() => {
								return false;
							}));
						if (!targetMember)
							return await sendEmbed(interaction, 'Could not find user');
					}
					if (targetMember.id === client.user.id)
						return await sendEmbed(interaction, 'You cannot ban me');

					if (targetMember.id === user.id)
						return await sendEmbed(interaction, 'You cannot ban yourself');

					if (!targetMember.bannable)
						return await sendEmbed(interaction, 'User is not bannable');

					if (
						member.roles.highest.position <= targetMember.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'You cannot ban a member with a higher role than you'
						);

					if (!reason) {
						reason = 'No reason provided';
						auditLogsReason = `Banned by @${user.username} | Reason: No reason provided`;
					} else {
						auditLogsReason = `Banned by @${user.username} | Reason: ${reason}`;
					}

					// Ban DM Embed
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`You have been banned from **${guild.name}**`)
						.addFields(
							{ name: 'Reason', value: reason },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetMember.send({ embeds: [Embed] }).catch(async (error) => {
						// await sendErrorEmbed(interaction, error);
						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription(
								`${targetMember} has DMs disabled, unable to send ban message`
							)
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						await interaction.editReply({ embeds: [Embed] });
						await sleep(5000);
					});

					// Ban the target user
					await targetMember
						.ban({
							deleteMessageSeconds: 60 * 60 * 24 * 7,
							reason: auditLogsReason,
						})
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error banning this user`
								))
							);
						});

					// Interaction reply embed
					const Embed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Ban')
						.setDescription(
							`You banned <@${targetMember.id}> from the server  `
						)
						.addFields(
							{ name: 'Reason', value: reason },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [Embed2] });

					break;
				case 'unban':
					// Variables
					const targetUseridUnban = options.getString('userid');

					const targetUserFetchedUnban = await client.users
						.fetch(targetUseridUnban)
						.catch(() => {
							return false;
						});

					if (!targetUserFetchedUnban)
						return await sendEmbed(interaction, 'Could not find user');

					if (targetUserFetchedUnban.id === client.user.id)
						return await sendEmbed(interaction, 'You cannot unban me');

					if (targetUserFetchedUnban.id === user.id)
						return await sendEmbed(interaction, 'You cannot unban yourself');

					const bannedUsers = await guild.bans.fetch().catch(async (error) => {
						return (
							(await sendErrorEmbed(interaction, error)) &&
							(await sendEmbed(
								interaction,
								`There was an error fetching the banned users`
							))
						);
					});

					if (!bannedUsers.has(targetUserFetchedUnban.id))
						return await sendEmbed(interaction, 'This user is not banned');

					// DM Unban Embed
					const UnbanEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`• You have been unbanned from **${guild.name}** •`)
						.addFields({
							name: 'Moderator',
							value: `${user.username} | (${member})`,
							inline: true,
						})
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetUserFetchedUnban
						.send({ embeds: [UnbanEmbed] })
						.catch(async (error) => {
							await sendEmbed(
								interaction,
								`${targetUserFetchedUnban} has DMs disabled or does not have a common server with the bot, unable to send unban message`
							);
							await sleep(5000);
						});

					await guild.members
						.unban(targetUserFetchedUnban.id, `Unbanned by ${user.username}`)
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error unbanning this user`
								))
							);
						});

					// Interaction reply embed
					const UnbanEmbed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Unban')
						.setDescription(
							`You unbanned ${targetUserFetchedUnban} from the server  `
						)
						.addFields({
							name: 'Moderator',
							value: `@${user.username} | (${member})`,
							inline: true,
						})
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [UnbanEmbed2] });

					break;

				default:
					return await sendEmbed(interaction, 'Something went wrong 2');
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
