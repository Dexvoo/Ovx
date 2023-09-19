const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
	ChannelType,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unban')
		.setDescription('Unban a specified user from a guild.')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('userid')
				.setDescription('The specified userid to unban.')
				.setRequired(true)
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
			if (!(await guildCheck(interaction))) return;

			// Bot permissions
			const botPermissionsArry = ['BanMembers', 'CreateInstantInvite'];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0]) {
				if (botPermissions[1] !== 'CreateInstantInvite') {
					await sendEmbed(
						interaction,
						`Bot Missing Permissions: \`${botPermissions[1]}\``
					);
				}
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

			await sendEmbed(interaction, 'Attempting to unban user');
			await sleep(2000);

			// Variables
			const targetUser = options.getString('userid');

			// Getting user with client
			const targetUserFetched = await client.users
				.fetch(targetUser)
				.catch(async (error) => {
					return false;
				});

			// Checking if the target is a user
			if (!targetUserFetched)
				return await sendEmbed(interaction, 'Please specify a valid userid');

			// Checking if the target is the command user
			if (targetUserFetched.id === user.id)
				return await sendEmbed(interaction, 'You cannot unban yourself');

			// Fetching banned users
			const bannedUsers = await guild.bans.fetch().catch(async (error) => {
				return (
					(await sendErrorEmbed(interaction, error)) &&
					(await sendEmbed(
						interaction,
						`There was an error fetching the banned users`
					))
				);
			});

			// Checking if the target user is banned
			if (!bannedUsers.has(targetUserFetched.id))
				return await sendEmbed(interaction, 'This user is not banned');

			// DM Unban Embed
			const DMUnbanEmbed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`• You have been unbanned from **${guild.name}** •`)
				.addFields({
					name: 'Moderator',
					value: `${user.username} | (${member})`,
					inline: true,
				})
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			// Getting the first text channel in the guild
			await guild.channels.cache
				.filter((channel) => channel.type === ChannelType.GuildText)
				.first()
				// Create invite link for 1 day so it expires over time
				.createInvite({
					temporary: false,
					maxAge: 86400,
					maxUses: 1,
					unique: false,
					reason: `Unbanned by @${user.username}`,
				})
				.then((invite) => {
					// Successfully got invite link
					DMUnbanEmbed.addFields({
						name: 'Invite Link',
						value: `[Click to Join](${invite.url})`,
						inline: true,
					});
				})
				.catch((error) => {
					// Error getting invite link
					DMUnbanEmbed.addFields({
						name: 'Invite Link',
						value: `Error getting invite link`,
						inline: true,
					});
				});

			// DM the target user
			await targetUserFetched.send({ content: '222' }).catch(async (error) => {
				// await sendErrorEmbed(interaction, error);
				console.log('Error sending DM');
				await sendEmbed(
					interaction,
					`${targetUserFetched} has DMs disabled or does not have a common server with the bot, unable to send unban message`
				);
				await sleep(5000);
			});

			// Unban the target user
			await guild.members
				.unban(targetUserFetched.id, `Unbanned by @${user.username}`)
				.catch(async (error) => {
					return (
						(await sendErrorEmbed(interaction, error)) &&
						(await sendEmbed(
							interaction,
							`There was an error unbanning this user`
						))
					);
				});

			// Unbanned user embed
			const Embed2 = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle('Unban')
				.setDescription(`You unbanned ${targetUserFetched} from the server  `)
				.addFields({
					name: 'Moderator',
					value: `@${user.username} | (${member})`,
					inline: true,
				})
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			await interaction.editReply({ embeds: [Embed2] });
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
