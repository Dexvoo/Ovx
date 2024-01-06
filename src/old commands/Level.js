const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../utils/Checks.js');
const { sleep } = require('../utils/ConsoleLogs.js');
const Levels = require('../models/GuildLevels.js');
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
	cooldown: 5,
	catagory: 'Levels',
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('Shows your current level and XP in the guild.')
		.setDMPermission(false)
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user to get information on.')
				.setRequired(false)
		),
	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// Placeholder embed
			await sendEmbed(interaction, 'Gathering user information');
			await sleep(2000);

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Variables
			const target = options.getUser('user') || user;

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

			const userData = await Levels.findOne(query);

			// Embed
			const LevelEmbed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(`• Levels/Rank •`)
				.setDescription(
					[
						`- User: ${target}`,
						`- Level: **${userData.level}**`,
						`- XP: **${userData.xp}**`,
						`- Messages: **${userData.messages}**`,
						`- Voice Time: **${userData.voice}** minutes`,
					].join('\n')
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			return interaction.editReply({ embeds: [LevelEmbed] });
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
