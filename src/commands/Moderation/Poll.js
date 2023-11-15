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
const GuildPolls = require('../../models/GuildPolls.js');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText, SuccessEmoji, ErrorEmoji } =
	process.env;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('poll')
		.setDescription('Create a poll.')
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('question')
				.setDescription('The question to ask in the poll.')
				.setRequired(true)
		)
		.addRoleOption((option) =>
			option
				.setName('role')
				.setDescription('The role to ping in the poll.')
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
			const botPermissionsArry = [
				'SendMessages',
				'ViewChannel',
				'AddReactions',
			];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0]) {
				await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);
				return;
			}

			// User permissions
			const userPermissionsArry = ['ManageMessages'];
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

			await sendEmbed(interaction, 'Starting poll');
			await sleep(2000);

			// Variables
			const question = interaction.options.getString('question');
			const role = interaction.options.getRole('role');

			if (question.length > 1000) {
				await sendEmbed(
					interaction,
					'The question is too long, please shorten it to 1,000 characters or less'
				);
				return;
			}

			if (question.length < 2) {
				await sendEmbed(
					interaction,
					'The question is too short, please make the question 2 characters or more'
				);
				return;
			}

			const pollEmbed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(`Poll by @${member.user.username}`)
				.setDescription(`${question}`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			var pollChannel = channel;

			if (role) {
				const everyoneRole = guild.roles.everyone;
				if (role.id === everyoneRole.id) {
					// user permissions
					const userPermissionsArry = ['MentionEveryone'];
					const userPermissions = await permissionCheck(
						interaction,
						userPermissionsArry,
						member
					);

					if (!userPermissions[0]) {
						await sendEmbed(
							interaction,
							`User Missing Permissions: \`${userPermissions[1]}\``
						);
						return;
					}
				}

				if (
					!role.mentionable &&
					!guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone)
				) {
					await sendEmbed(
						interaction,
						`The role \`${role.name}\` is not mentionable, please make it mentionable or give me the \`Mention Everyone\` permission`
					);
					return;
				}

				await pollChannel
					.send({ content: `${role}`, embeds: [pollEmbed] })
					.then(async (message) => {
						var emojiYes = '✅';
						var emojiNo = '❌';

						if (
							guild.members.me.permissions.has(
								PermissionFlagsBits.UseExternalEmojis
							)
						) {
							emojiYes = `${SuccessEmoji}`;
							emojiNo = `${ErrorEmoji}`;
						}

						await message.react(emojiYes);
						await message.react(emojiNo);
					});
				await sendEmbed(interaction, 'Poll has been created');
				return;
			}

			await pollChannel.send({ embeds: [pollEmbed] });
			await sendEmbed(interaction, 'Poll has been created');
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
