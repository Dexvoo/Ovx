const {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonStyle,
	ButtonBuilder,
	ActionRowBuilder,
	CommandInteraction,
} = require('discord.js');
const {
	FooterText,
	FooterImage,
	EmbedColour,
	RobloxAPIKey,
	OsuClientID,
	OsuRedirectUri,
} = process.env;
const translate = require('@iamtraction/google-translate');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { sleep, cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const {
	getUser,
	getUserRecentActivity,
} = require('../../utils/osu/getUser.js');
const { getAuth } = require('../../utils/osu/getAuth.js');
const { getApiKey } = require('../../utils/osu/getApiKey.js');
const VerificationSchema = require('../../models/VerifiedUsers.js');
const { getRankEmoji } = require('../../utils/osu/getRankEmoji.js');

module.exports = {
	cooldown: 5,
	catagory: 'Osu',
	data: new SlashCommandBuilder()
		.setName('osu')
		.setDescription('Osu commands')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('lookup')
				.setDescription('Look up a username.')
				.addStringOption((option) =>
					option
						.setName('username')
						.setDescription('The username you would like to look up.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('mode')
						.setDescription('The mode you would like to look up.')
						.setRequired(false)
						.addChoices(
							{ name: 'osu! Standard', value: 'osu' },
							{ name: 'Taiko', value: 'taiko' },
							{ name: 'Catch The Beat', value: 'fruits' },
							{ name: 'osu!mania', value: 'mania' }
						)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('auth').setDescription('Get an auth code for osu!')
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('mostrecent')
				.setDescription('Get the most recent osu! play.')
				.addStringOption((option) =>
					option
						.setName('mode')
						.setDescription('The mode you would like to look up.')
						.setRequired(true)
						.addChoices(
							{ name: 'osu! Standard', value: 'osu' },
							{ name: 'Taiko', value: 'taiko' },
							{ name: 'Catch The Beat', value: 'fruits' },
							{ name: 'osu!mania', value: 'mania' }
						)
				)
		),
	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		const { member, options, user, client } = interaction;

		await sendEmbed(interaction, `Gathering osu! data`);

		const subcommand = options.getSubcommand();
		console.log(subcommand);

		switch (subcommand) {
			case 'lookup':
				const targetUsername = options.getString('username');
				const targetMode = options.getString('mode') || 'osu';

				const osuData = await getUser(targetUsername, targetMode);

				const {
					avatar_url,
					country_code,
					default_group,
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
				const play_time = (statistics.play_time / 3600).toFixed(0); // Hours

				if (statistics.global_rank === null) statistics.global_rank = 0;
				if (statistics.country_rank === null) statistics.country_rank = 0;

				var emoji = '';

				switch (targetMode) {
					case 'osu':
						emoji = '<:OVX_osu_std:1180937672005537944>';
						break;
					case 'taiko':
						emoji = '<:OVX_osu_taiko:1180951886887665695>';
						break;
					case 'fruits':
						emoji = '<:OVX_osu_ctb:1180951881682518016>';
						break;
					case 'mania':
						emoji = '<:OVX_osu_mania:1180951884056510545>';
						break;
				}

				const embed = new EmbedBuilder()
					.setAuthor({
						name: `${username}: ${statistics.pp.toLocaleString()}pp (🌍: #${
							statistics.global_rank.toLocaleString() || 0
						} | ${country_code}: #${statistics.country_rank.toLocaleString()})`,
						iconURL: `https://osuflags.omkserver.nl/${country_code}.png`,
						url: `https://osu.ppy.sh/users/${username}/${targetMode}`,
					})
					.setDescription(
						`Accuracy: \`${statistics.hit_accuracy.toFixed(
							2
						)}\` • Level: \`${FinalLevel}\`
					Playcount: \`${statistics.play_count.toLocaleString()}\` (\`${play_time} hours\`)
					${emoji} • Medals: \`${user_achievements.length}\`
					Peak Rank: \`#${rank_highest.rank.toLocaleString()}\` (${highestRankDate})
					Joined osu!: ${joinedOsuDateFormatted} (${joinedOsuDate})
					`
					)
					.setColor(EmbedColour)
					.setThumbnail(avatar_url);

				await interaction.editReply({ embeds: [embed] });

				break;

			case 'auth':
				interaction.editReply({
					content: `This command is currently disabled.`,
				});
				// interaction.editReply({
				// 	content: `https://osu.ppy.sh/oauth/authorize?client_id=${OsuClientID}&redirect_uri=${OsuRedirectUri}&response_type=code&scope=public+identify&state=randomval`,
				// });

				break;

			case 'mostrecent':
				const targetModeRecent = options.getString('mode') || 'osu';
				console.log('target mode: ', targetModeRecent);

				// get database data
				const recentData = await VerificationSchema.findOne({
					discordUserId: member.id,
				});

				if (!recentData?.osuUserId) {
					return await sendEmbed(
						interaction,
						'Please verify your account first! with `/verify osu`'
					);
				}

				const osuRecentData = await getUserRecentActivity(
					recentData.osuUserId,
					targetModeRecent
				);

				if (osuRecentData === false) {
					return await sendEmbed(interaction, 'That username is invalid!');
				}

				const {
					beatmap,
					beatmapset,
					created_at,
					id,
					max_combo,
					mod_combination,
					perfect,
					pp,
					rank,
					score,
					statistics: {
						count_100,
						count_300,
						count_50,
						count_geki,
						count_katu,
						count_miss,
						hits,
					},
					user,
				} = osuRecentData[0];

				console.log(osuRecentData[0]);
				const timeSet = `<t:${Math.floor(
					new Date(osuRecentData[0].created_at) / 1000
				)}:R>`;

				const EmbedRecent = new EmbedBuilder()
					.setColor(EmbedColour)
					.setFooter({
						text: `${FooterText}`,
						iconURL: `${FooterImage}`,
					})
					.setAuthor({
						name: `${user.username}: ${0}pp (🌍: #${0} | ${
							user.country_code
						}: #${0})`,
						iconURL: `https://osuflags.omkserver.nl/${user.country_code}.png`,
						url: `https://osu.ppy.sh/users/${user.username}/${targetModeRecent}`,
					})
					.setDescription(
						`
					**[${beatmapset.artist} - ${beatmapset.title} [${beatmap.version}] [${
						beatmap.difficulty_rating
					}✩]](${beatmap.url})**

					**${await getRankEmoji(rank)}  •  ${score.toLocaleString()} • (${
						osuRecentData[0].accuracy.toFixed(2) * 100
					}%)  •  ${timeSet}**
				
					`
					)
					.setThumbnail(beatmapset.covers.list);

				interaction.editReply({ embeds: [EmbedRecent] });
				break;

			default:
				break;
		}
	},
};
