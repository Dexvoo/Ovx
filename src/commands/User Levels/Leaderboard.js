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
		.setName('leaderboard')
		.setDescription(
			'Displays the most active users in a leaderboard (Guild Only).'
		)
		.setDMPermission(false),
	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// Placeholder embed
			await sendEmbed(interaction, 'Gathering leaderboard data');
			await sleep(2000);

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Variables
			const rawLeaderboard = await fetchLeaderboard(guild.id, 25);
			var totalGuildLevels = 0;

			// Checking if the leaderboard is empty
			if (rawLeaderboard.length < 1) {
				await sendEmbed(
					interaction,
					'0 users have earned xp in this guild, please send messages to earn xp'
				);
				return;
			}

			const leaderboard = await computeLeaderboard(
				client,
				rawLeaderboard,
				true
			);
			const totalGuildLevels2 = leaderboard[1];
			const lb = leaderboard[0].map(
				(e) =>
					`\`` +
					`${e.position}`.padStart(2, ' ') +
					`\`. \`@` +
					`${e.username}`.padEnd(18, ' ') +
					`\` | Level: \`${e.level}\` | XP: \`${e.xp.toLocaleString()}\``
			);

			// Embed
			const LeaderboardEmbed = new EmbedBuilder()
				.setTitle(`${guild.name} | Level Leaderboard`)
				.setThumbnail(guild.iconURL())
				.addFields(
					{
						name: 'Total Guild Levels',
						value: totalGuildLevels2.toLocaleString(),
						inline: true,
					},
					{
						name: 'Total Guild Users',
						value: rawLeaderboard.length.toLocaleString(),
						inline: true,
					}
				)
				.setTimestamp()
				.setColor(EmbedColour)
				.setFooter({ text: FooterText, iconURL: FooterImage });

			const pageSize = 5;
			for (let i = 0; i < lb.length; i += pageSize) {
				const page = lb.slice(i, i + pageSize);
				const name = `Top ${i + 1}-${Math.min(i + pageSize, lb.length)}`;
				const value = page.join('\n');
				LeaderboardEmbed.addFields({ name, value, inline: false });
			}

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
			return interaction.editReply({ embeds: [LeaderboardEmbed] });
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

// Functions
async function fetchLeaderboard(guildId, limit) {
	if (!guildId) throw new TypeError('A guild id was not provided.');
	if (!limit) throw new TypeError('A limit was not provided.');

	var users = await Levels.find({ guildId: guildId })
		.sort([
			['level', 'descending'],
			['xp', 'descending'],
		])
		.exec();

	return users;
}

async function computeLeaderboard(client, leaderboard, fetchUsers = false) {
	if (!client) throw new TypeError('A client was not provided.');
	if (!leaderboard) throw new TypeError('A leaderboard id was not provided.');

	if (leaderboard.length < 1) return [];

	const computedArray = [];
	var totalGuildLevels = 0;

	if (fetchUsers) {
		for (const key of leaderboard) {
			const user = await client.users.fetch(key.userId);
			totalGuildLevels = totalGuildLevels + key.level;

			computedArray.push({
				guildId: key.guildId,
				userId: key.userId,
				xp: key.xp,
				level: key.level,
				position:
					leaderboard.findIndex(
						(i) => i.guildId === key.guildId && i.userId === key.userId
					) + 1,
				username: user ? user.username : 'Unknown',
			});
		}
	} else {
		leaderboard.map((key) =>
			computedArray.push({
				guildID: key.guildID,
				userID: key.userID,
				xp: key.xp,
				level: key.level,
				position:
					leaderboard.findIndex(
						(i) => i.guildID === key.guildID && i.userID === key.userID
					) + 1,
				username: client.users.cache.get(key.userID)
					? client.users.cache.get(key.userID).username
					: 'Unknown',
			})
		);
	}

	return [computedArray, totalGuildLevels];
}
