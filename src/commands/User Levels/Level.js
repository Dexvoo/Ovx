const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
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
					].join('\n')
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			// if (lb.length < 5) {
			// 	LeaderboardEmbed.addFields({
			// 		name: `Top 1-${lb.length}`,
			// 		value: lb.join('\n'),
			// 		inline: false,
			// 	});
			// } else if (lb.length > 5 && lb.length <= 10) {
			// 	LeaderboardEmbed.addFields(
			// 		{
			// 			name: 'Top 5',
			// 			value: lb.slice(0, 5).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: `Top 6-${lb.length}`,
			// 			value: lb.slice(5, lb.length).join('\n'),
			// 		}
			// 	);
			// } else if (lb.length > 10 && lb.length <= 15) {
			// 	LeaderboardEmbed.addFields(
			// 		{
			// 			name: 'Top 1-5',
			// 			value: lb.slice(0, 5).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 6-10',
			// 			value: lb.slice(5, 10).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: `Top 11-${lb.length}`,
			// 			value: lb.slice(10, lb.length).join('\n'),
			// 			inline: false,
			// 		}
			// 	);
			// } else if (lb.length > 15 && lb.length <= 20) {
			// 	LeaderboardEmbed.addFields(
			// 		{
			// 			name: 'Top 1-5',
			// 			value: lb.slice(0, 5).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 6-10',
			// 			value: lb.slice(5, 10).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 11-15',
			// 			value: lb.slice(10, 15).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: `Top 16-${lb.length}`,
			// 			value: lb.slice(15, lb.length).join('\n'),
			// 			inline: false,
			// 		}
			// 	);
			// } else if (lb.length > 20 && lb.length <= 24) {
			// 	LeaderboardEmbed.addFields(
			// 		{
			// 			name: 'Top 1-5',
			// 			value: lb.slice(0, 5).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 6-10',
			// 			value: lb.slice(5, 10).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 11-15',
			// 			value: lb.slice(10, 15).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 16-20',
			// 			value: lb.slice(15, 20).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: `Top 21-${lb.length}`,
			// 			value: lb.slice(20, lb.length).join('\n'),
			// 			inline: false,
			// 		}
			// 	);
			// } else if (lb.length >= 25) {
			// 	LeaderboardEmbed.addFields(
			// 		{
			// 			name: 'Top 1-5',
			// 			value: lb.slice(0, 5).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 6-10',
			// 			value: lb.slice(5, 10).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 11-15',
			// 			value: lb.slice(10, 15).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 16-20',
			// 			value: lb.slice(15, 20).join('\n'),
			// 			inline: false,
			// 		},
			// 		{
			// 			name: 'Top 21-25',
			// 			value: lb.slice(20, 25).join('\n'),
			// 			inline: false,
			// 		}
			// 	);
			// }
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
