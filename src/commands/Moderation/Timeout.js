const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('timeout')
		.setDescription('Timeout a specified user from a guild.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setDMPermission(false)
		.addUserOption((option) =>
			option
				.setName('member')
				.setDescription('The specified member to timeout.')
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('duration')
				.setDescription('How long do you want to timeout this user for')
				.setRequired(true)
				.addChoices(
					{ name: '60 Seconds', value: '60Sec' },
					{ name: '5 Minutes', value: '5Min' },
					{ name: '10 Minutes', value: '10Min' },
					{ name: '1 Hour', value: '1Hour' },
					{ name: '1 Day', value: '1Day' },
					{ name: '1 Week', value: '1Week' }
				)
		)
		.addStringOption((option) =>
			option
				.setName('reason')
				.setDescription('The reason for the timeout.')
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
			if (!(await guildCheck(interaction))) return;

			// Bot permissions
			const botPermissionsArry = ['ModerateMembers'];
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
			const userPermissionsArry = ['ModerateMembers'];
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

			await sendEmbed(interaction, 'Attempting to timeout user');
			await sleep(2000);

			// Variables
			const targetMember = options.getMember('member');
			const duration = options.getString('duration');
			var durationInMS;
			var reason = options.getString('reason');
			var reason2;
			const timeBeforeTimeout = Date.now();

			switch (duration) {
				case '60Sec':
					durationInMS = 60000;
					break;
				case '5Min':
					durationInMS = 60000 * 5;
					break;
				case '10Min':
					durationInMS = 60000 * 10;
					break;
				case '1Hour':
					durationInMS = 60000 * 60;
					break;
				case '1Day':
					durationInMS = 60000 * 60 * 24;
					break;
				case '1Week':
					durationInMS = 60000 * 60 * 24 * 7;
					break;
				default:
					return await sendEmbed(interaction, 'Invalid duration');
			}

			// get time after timeout
			var timeAfterTimeout = Date.now() + durationInMS;

			// Checking if the target is a member
			if (!targetMember)
				return await sendEmbed(interaction, 'Please specify a valid member');

			// Checking if the target is a bot
			if (targetMember.user.bot)
				return await sendEmbed(interaction, 'You cannot timeout a bot');

			// Checking if the target is the command user
			if (targetMember.id === user.id)
				return await sendEmbed(interaction, 'You cannot timeout yourself');

			// Checking if the target user is moderatable
			if (!targetMember.moderatable)
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions | \`RoleHierarchy\``
				);

			// Checking If the interaction member has a higher role than the target member
			if (member.roles.highest.position <= targetMember.roles.highest.position)
				return await sendEmbed(
					interaction,
					'You cannot timeout a member with a higher role than you'
				);

			// Checking if the reason is valid
			if (!reason) {
				reason2 = `timeouted by @${user.username} | Reason: No reason provided`;
			} else {
				reason2 = `timeouted by @${user.username} | Reason: ${reason}`;
			}

			// DM the target user
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`You have been timeouted from **${guild.name}**`)
				.addFields(
					{ name: 'Reason', value: reason },
					{
						name: 'Moderator',
						value: `@${user.username} | (${member})`,
						inline: true,
					},
					{
						name: 'Ends',
						value: `<t:${(timeAfterTimeout / 1000).toFixed(0)}:R>`,
						inline: false,
					}
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			await targetMember.send({ embeds: [Embed] }).catch(async (error) => {
				// await sendErrorEmbed(interaction, error);
				const Embed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription(
						`${targetMember} has DMs disabled, unable to send timeout message`
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				await interaction.editReply({ embeds: [Embed] });
				await sleep(5000);
			});

			// Timeout the target user
			await targetMember.timeout(durationInMS, reason2).catch(async (error) => {
				return (
					(await sendErrorEmbed(interaction, error)) &&
					(await sendEmbed(
						interaction,
						`There was an error timing out this user`
					))
				);
			});

			// Banned user embed
			const Embed2 = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle('Timeout')
				.setDescription(`You timedout <@${targetMember.id}> from the server  `)
				.addFields(
					{ name: 'Reason', value: reason },
					{
						name: 'Moderator',
						value: `@${user.username} | (${member})`,
						inline: true,
					},
					{
						name: 'Ends',
						value: `<t:${(timeAfterTimeout / 1000).toFixed(0)}:R>`,
						inline: false,
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
