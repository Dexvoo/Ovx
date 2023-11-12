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
					`\` | L: \`${
						e.level
					}\` | XP: \`${e.xp.toLocaleString()}\` | M: \`${e.messages.toLocaleString()}\` | V: \`${e.voice.toLocaleString()}\``
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
			const maxPages = 3;
			let currentPage = 1; // Initialize the current page to 1

			for (let i = 0; i < lb.length && currentPage <= maxPages; i += pageSize) {
				const page = lb.slice(i, i + pageSize);
				const name = `Top ${i + 1}-${Math.min(i + pageSize, lb.length)}`;
				const value = page.join('\n');
				LeaderboardEmbed.addFields({ name, value, inline: false });

				currentPage++; // Increment the current page number
			}
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
				messages: key.messages,
				voice: key.voice,
				position:
					leaderboard.findIndex(
						(i) => i.guildId === key.guildId && i.userId === key.userId
					) + 1,
				username: user ? user.username : 'Unknown',
			});
		}
	} else {
		totalGuildLevels = totalGuildLevels + key.level;
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
