const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const UserCurrency = require('../../models/UserCurrency.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
	SuccessEmoji,
	ErrorEmoji,
	CloudConvertAPIKey,
} = process.env;
require('dotenv').config();
const http = require('https'); // or 'https' for https:// URLs
const fs = require('fs');
const axios = require('axios');
const { getUser } = require('../../utils/osu/getUser.js');

module.exports = {
	cooldown: 0,
	catagory: 'Developer',
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('developer test command.')
		.setDMPermission(false),

	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			const { guild, member, options, client, channel } = interaction;
			if (member.user.id !== '387341502134878218') {
				await sendEmbed(
					interaction,
					'You do not have permission to use this command.'
				);
			}

			const osuData = await getUser('Doge Owdddddner');

			const {
				avatar_url,
				country_code,
				default_group,
				id,
				is_active,
				is_bot,
				is_deleted,
				is_online,
				is_supporter,
				last_visit,
				pm_friends_only,
				profile_colour,
				username,
				cover_url,
				discord,
				has_supported,
				interests,
				join_date,
				location,
				max_blocks,
				max_friends,
				occupation,
				playmode,
				playstyle,
				post_count,
				profile_order,
				title,
				title_url,
				twitter,
				website,
				country,
				cover,
				kudosu,
				account_history,
				active_tournament_banner,
				active_tournament_banners,
				badges,
				beatmap_playcounts_count,
				comments_count,
				favourite_beatmapset_count,
				follower_count,
				graveyard_beatmapset_count,
				groups,
				guest_beatmapset_count,
				loved_beatmapset_count,
				mapping_follower_count,
				monthly_playcounts,
				nominated_beatmapset_count,
				page,
				pending_beatmapset_count,
				previous_usernames,
				rank_highest,
				ranked_beatmapset_count,
				replays_watched_counts,
				scores_best_count,
				scores_first_count,
				scores_pinned_count,
				scores_recent_count,
				statistics,
				support_level,
				user_achievements,
				rankHistory,
				ranked_and_approved_beatmapset_count,
				unranked_beatmapset_count,
			} = osuData;
			console.log(osuData);

			if (osuData === false) {
				return await sendEmbed(interaction, 'That username is invalid!');
			}

			const LevelProgress = statistics.level.progress;
			const LevelProgressPercentage = LevelProgress / 100;
			const FinalLevel = statistics.level.current + LevelProgressPercentage;

			const highestRankDate = `<t:${Math.floor(
				new Date(rank_highest.updated_at) / 1000
			)}:d>`;

			const joinedOsuDate = `<t:${Math.floor(new Date(join_date) / 1000)}:R>`;
			const joinedOsuDateFormatted = `<t:${Math.floor(
				new Date(join_date) / 1000
			)}:d>`;

			if (statistics.global_rank === null) statistics.global_rank = 0;
			if (statistics.country_rank === null) statistics.country_rank = 0;

			const embed = new EmbedBuilder()
				.setAuthor({
					name: `${username}: ${statistics.pp.toLocaleString()}pp (🌍: #${
						statistics.global_rank.toLocaleString() || 0
					} | ${country_code}: #${statistics.country_rank.toLocaleString()})`,
					iconURL: `https://osuflags.omkserver.nl/${country_code}.png`,
					url: `https://osu.ppy.sh/users/${id}/osu`,
				})
				.setDescription(
					`Accuracy: \`${statistics.hit_accuracy.toFixed(
						2
					)}\` • Level: \`${FinalLevel}\`
					<:OVX_osu_std:1180937672005537944> • Medals: \`${user_achievements.length}\`
					Peak Rank: \`#${rank_highest.rank.toLocaleString()}\` (${highestRankDate})
					Joined osu!: ${joinedOsuDateFormatted} (${joinedOsuDate})
					`
				)
				.setColor(EmbedColour)
				.setThumbnail(avatar_url);

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.log(error);
		}
	},
};
