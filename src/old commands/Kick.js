const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../utils/Checks.js');
const { sleep } = require('../utils/ConsoleLogs.js');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Kick a specified user from a guild.')
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDMPermission(false)
		.addUserOption((option) =>
			option
				.setName('member')
				.setDescription('The specified member to kick.')
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('reason')
				.setDescription('The reason for the kick.')
				.setRequired(false)
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
			const botPermissionsArry = ['KickMembers'];
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
			const userPermissionsArry = ['KickMembers'];
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

			await sendEmbed(interaction, 'Attempting to kick user');
			await sleep(2000);

			// Variables
			const targetMember = options.getMember('member');
			var reason = options.getString('reason');
			var reason2;

			// Checking if the target is a member
			if (!targetMember)
				return await sendEmbed(interaction, 'Please specify a valid member');

			// Checking if the target is a bot
			if (targetMember.user.bot)
				return await sendEmbed(interaction, 'You cannot kick a bot');

			// Checking if the target is the command user
			if (targetMember.id === user.id)
				return await sendEmbed(interaction, 'You cannot kick yourself');

			// Checking if the target user is kickable
			if (!targetMember.kickable)
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions | \`RoleHierarchy\``
				);

			// Checking If the interaction member has a higher role than the target member
			if (member.roles.highest.position <= targetMember.roles.highest.position)
				return await sendEmbed(
					interaction,
					'You cannot kick a member with a higher role than you'
				);

			// Checking if the reason is valid
			if (!reason) {
				reason2 = `Kicked by @${user.username} | Reason: No reason provided`;
			} else {
				reason2 = `Kicked by @${user.username} | Reason: ${reason}`;
			}

			// DM the target user
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`You have been kicked from **${guild.name}**`)
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
						`${targetMember} has DMs disabled, unable to send kick message`
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				await interaction.editReply({ embeds: [Embed] });
				await sleep(5000);
			});

			// Kick the target user
			await targetMember.kick(reason2).catch(async (error) => {
				return (
					(await sendErrorEmbed(interaction, error)) &&
					(await sendEmbed(interaction, `There was an error kicking this user`))
				);
			});

			// Banned user embed
			const Embed2 = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle('kick')
				.setDescription(`You kicked <@${targetMember.id}> from the server  `)
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
