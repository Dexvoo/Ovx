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
		.setName('nickname')
		.setDescription("Change a user's nickname.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
		.setDMPermission(false)
		.addUserOption((option) =>
			option
				.setName('member')
				.setDescription('The user you would like to change the nickname of.')
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('nickname')
				.setDescription('The nickname you would like to change the member to.')
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
			if (!(await guildCheck(guild))) return;

			// Bot permissions
			const botPermissionsArry = ['ManageNicknames'];
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
			const userPermissionsArry = ['ManageNicknames'];
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

			await sendEmbed(interaction, 'Attempting to change nickname');
			await sleep(2000);

			// Variables
			const targetMember = options.getMember('member');
			const targetNickname = options.getString('nickname');
			const targetOldNickname =
				targetMember.nickname || `@${targetMember.user.username}`;

			// Checking if the target is a member
			if (!targetMember)
				return await sendEmbed(interaction, 'Please specify a valid member');

			// Checking if tartget is the client user
			if (targetMember.id === client.user.id)
				return await sendEmbed(interaction, 'You cannot change my nickname');

			// Checking If the interaction member has a higher role than the target member
			if (member.roles.highest.position <= targetMember.roles.highest.position)
				return await sendEmbed(
					interaction,
					'You cannot change a member`s nickname with a higher role than you'
				);

			// Checking if the nickname is less than 32 characters
			if (targetNickname.length > 32)
				return await sendEmbed(
					interaction,
					'The nickname must be less than 32 characters'
				);

			// Checking if the nickname is the same as the old nickname
			if (targetNickname === targetOldNickname)
				return await sendEmbed(
					interaction,
					'The nickname must be different from the old nickname'
				);

			// Change the nickname
			await targetMember.setNickname(targetNickname);

			// DM the target user
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`Your nickname has been changed in **${guild.name}**`)
				.addFields(
					{ name: 'Old Nickname', value: targetOldNickname, inline: true },
					{ name: 'New Nickname', value: targetNickname, inline: true },
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
						`${targetMember} has DMs disabled, unable to send a message`
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				await interaction.editReply({ embeds: [Embed] });
				await sleep(5000);
			});

			// Nickname changed embed
			const Embed2 = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle('Nickname')
				.setDescription(`You Changed the nickname of ${targetMember}`)
				.addFields(
					{ name: 'Old Nickname', value: targetOldNickname, inline: true },
					{ name: 'New Nickname', value: targetNickname, inline: true },
					{
						name: 'Moderator',
						value: `@${user.username} | (${member})`,
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
