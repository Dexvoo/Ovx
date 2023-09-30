const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
	PermissionsBitField,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { calculateLevel } = require('../../utils/XP.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const Levels = require('../../models/GuildLevels.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
} = process.env;
require('dotenv').config();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('levela')
		.setDescription('Change a users current level and XP in the guild.')
		.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('The type of change to make.')
				.setRequired(true)
				.addChoices(
					{
						name: 'Level',
						value: 'level',
					},
					{
						name: 'XP',
						value: 'xp',
					},
					{
						name: 'Reset',
						value: 'reset',
					}
				)
		)
		.addIntegerOption((option) =>
			option
				.setName('levelxp')
				.setDescription('The level/XP to change to.')
				.setRequired(false)
		)

		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user to change.')
				.setRequired(false)
		),
	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } =
				await interaction;

			// Placeholder embed
			await sendEmbed(interaction, 'Gathering user information');
			await sleep(2000);

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Variables
			const target = options.getUser('user') || user;
			const type = options.getString('type');
			// Providing guild id and user id for query
			const query = { guildId: guild.id, userId: target.id };

			// Checking if the user is in the database
			const userExists = await Levels.exists(query);

			if (!userExists) {
				await sendEmbed(
					interaction,
					`${target.username} has not sent any messages in this guild, please send messages to earn xp`
				);
				return;
			}

			switch (type) {
				case 'level':
					const level = options.getInteger('levelxp');
					// if level is a positive number
					if (level < 1) {
						await sendEmbed(
							interaction,
							'Please provide a valid level to change to'
						);
						return;
					}

					// Getting user data
					const userData2 = await Levels.findOne(query);

					// Setting user data
					userData2.level = level;
					userData2.xp = 0;

					// Saving user data
					await userData2.save().catch((error) => console.log(error));

					// Embed
					const LevelEmbed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`• Levels/Rank •`)
						.setDescription(
							[
								`- User: ${target}`,
								`- Level: **${userData2.level}**`,
								`- XP: **${userData2.xp}**`,
							].join('\n')
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					interaction.editReply({ embeds: [LevelEmbed2] });
					break;
				case 'xp':
					const xp = options.getInteger('levelxp');
					// if level is a positive number
					if (xp < 1) {
						await sendEmbed(
							interaction,
							'Please provide a valid xp to change to'
						);
						return;
					}

					// Getting user data
					const userData = await Levels.findOne(query);

					// Setting user data
					if (xp >= calculateLevel(userData.level)) {
						await sendEmbed(
							interaction,
							`Please provide a valid xp to change to, it needs to be below \`${calculateLevel(
								userData.level
							).toLocaleString()}\``
						);
						break;
					}

					userData.xp = xp;

					// Saving user data
					await userData.save().catch((error) => console.log(error));

					// Embed
					const LevelEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`• Levels/Rank •`)
						.setDescription(
							[
								`- User: ${target}`,
								`- Level: **${userData.level}**`,
								`- XP: **${userData.xp}**`,
							].join('\n')
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [LevelEmbed] });

					break;
				case 'reset':
					// Getting user data
					const userData3 = await Levels.findOne(query);

					// Setting user data
					userData3.level = 0;
					userData3.xp = 0;

					// Bot permissions
					const botPermissionsArry = ['ViewChannel'];
					const botPermissions = await permissionCheck(
						interaction,
						botPermissionsArry,
						client
					);

					if (!botPermissions[0])
						return await sendEmbed(
							interaction,
							`Bot Missing Permissions: \`${botPermissions[1]}\` | Cannot get response from user`
						);

					await sendEmbed(
						interaction,
						`Are you sure you want to reset ${target.username}'s level and xp? (yes/no)`
					);

					// message collector for confirmation
					const filter = (m) => m.author.id === interaction.user.id;
					const collector = channel.createMessageCollector({
						filter,
						time: 15000,
						max: 1,
					});

					// send message on timeout
					collector.on('end', async (collected) => {
						if (collected.size < 1) {
							await sendEmbed(
								interaction,
								'You did not respond in time, please try again, you have 15 seconds to respond'
							);
							return;
						}
					});

					collector.on('collect', async (m) => {
						if (m.content.toLowerCase() == 'yes') {
							await sendEmbed(
								interaction,
								`Resetting ${target.username}'s data`
							);
							await sleep(2000);
							// Saving user data
							await userData3.save().catch((error) => console.log(error));

							// Embed
							const LevelEmbed3 = new EmbedBuilder()
								.setColor(EmbedColour)
								.setTitle(`• Levels/Rank •`)
								.setDescription(
									[
										`- User: ${target}`,
										`- Level: **${userData3.level}**`,
										`- XP: **${userData3.xp}**`,
									].join('\n')
								)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });

							await interaction.editReply({ embeds: [LevelEmbed3] });
						} else {
							await sendEmbed(interaction, 'Cancelling reset');
							return;
						}
					});

					break;
			}
		} catch (error) {
			console.error(error);
			await sendErrorEmbed(interaction, error);
			return;
		}
	},
};
