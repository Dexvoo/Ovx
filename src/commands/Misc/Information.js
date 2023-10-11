const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	OAuth2Scopes,
	EmbedBuilder,
	PermissionsBitField,
	ChannelType,
	UserFlags,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const os = require('os');
const cpuStat = require('cpu-stat');
const pjson = require('../../../package.json');

const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
require('dotenv').config();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('information')
		.setDescription('Get information about a user, guild, role, or bot')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('user')
				.setDescription('Get information about a user')
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('The user you would like to get information about')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('server')
				.setDescription('Get information about the server')
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('bot').setDescription('Get information about the bot')
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('role')
				.setDescription('Get information about a role')
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('The role you would like to get information about')
						.setRequired(true)
				)
		),

	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		const { options } = interaction;
		const subcommandName = options.getSubcommand();

		// Placeholder Embed
		await sendEmbed(interaction, `Grabbing Information`);
		await sleep(2000);

		try {
			// Checking if the command is being used in a guild
			if (!(await guildCheck(interaction))) return;

			switch (subcommandName) {
				case 'user':
					await handleUserInformation(interaction);
					break;
				case 'server':
					await handleServerInformation(interaction);
					break;
				case 'bot':
					await handleBotInformation(interaction);
					break;
				case 'role':
					await handleRoleInformation(interaction);
					break;
				default:
					await sendEmbed(interaction, 'Please specify a valid subcommand.');
			}
		} catch (error) {
			console.error(error);
			await sendEmbed(
				interaction,
				'An error occurred while processing your request.'
			);
		}
	},
};

async function handleUserInformation(interaction) {
	// ... User information logic
	// Deconstructing interaction
	const { guild, member, options, user, client, channel } = interaction;

	if (!guild)
		return await sendEmbed(
			interaction,
			'This command can only be used in a guild'
		);

	// Variables
	const discordBadges = {
		ActiveDeveloper: '<:OVX_ActiveDeveloper:1115592693284876308>',
		BugHunterLevel1: '<:OVX_BugHunterLevel1:1115593411030949980>',
		BugHunterLevel2: '<:OVX_BugHunterLevel2:1115593413648191509>',
		CertifiedModerator: '<:OVX_CertifiedModerator:1115593415569199155>',
		HypeSquadOnlineHouse1: '<:OVX_Bravery:1115592699500822580>',
		HypeSquadOnlineHouse2: '<:OVX_Brilliance:1115592701581213707>',
		HypeSquadOnlineHouse3: '<:OVX_Balance:1115592695071649792>',
		HypeSquad: '<:OVX_Hypesquad:1115593419276955699>',
		Partner: '<:OVX_Partner:1115593830692036668>',
		PremiumEarlySupporter: '<:OVX_EarlySupporter:1115593417485983785>',
		Staff: '<:OVX_Staff:1115593834815037461>',
		VerifiedBot: '<:OVX_VerifiedBot:1115593836455010375>',
		VerifiedDeveloper: '<:OVX_VerifiedBotDeveloper:1115593838648639539>',
	};
	const userInformation = options.getMember('user');
	const memberInformation = await guild.members.fetch(userInformation.id);
	const userBadges =
		userInformation.user.flags
			.toArray()
			.map((badge) => discordBadges[badge])
			.join(' • ') || 'None';
	let userRoles;

	if (!userInformation)
		return await sendErrorEmbed(interaction, 'Please specify a valid user');

	// User permissions
	const userPermissionsArray = ['ManageMessages'];
	const userPermissions = await permissionCheck(
		channel,
		userPermissionsArray,
		client
	);

	const isUserStaff = userPermissions[0]
		? `• ${SuccessEmoji} •`
		: `• ${ErrorEmoji} •`;
	const isUserBot = userInformation.user.bot
		? `• ${SuccessEmoji}  •`
		: `• ${ErrorEmoji} •`;
	const isUserServerBoosting = memberInformation.premiumSinceTimestamp
		? `• ${SuccessEmoji} <t:${Math.round(
				new Date(memberInformation.premiumSince).getTime() / 1000
		  )}:R> •`
		: `• ${ErrorEmoji} •`;
	const userJoinedGuild = `<t:${Math.round(
		new Date(userInformation.joinedAt).getTime() / 1000
	)}:R>`;
	const userJoinedDiscord = `<t:${Math.round(
		new Date(userInformation.user.createdAt).getTime() / 1000
	)}:R>`;

	if (memberInformation.roles.cache.size > 1) {
		userRoles = memberInformation.roles.cache
			.filter((role) => role.name !== '@everyone')
			.map((role) => `<@&${role.id}>`)
			.join(' • ');
	} else {
		userRoles = 'None';
	}

	const Embed = new EmbedBuilder()
		.setColor(EmbedColour)
		.setAuthor({
			name: `User Information for @${userInformation.user.username}`,
			iconURL: userInformation.user.displayAvatarURL({ dynamic: true }),
		})
		.addFields(
			{
				name: 'Username',
				value: `@${userInformation.user.username}`,
				inline: true,
			},
			{
				name: 'Nickname',
				value: `${memberInformation.nickname || 'None'}`,
				inline: true,
			},
			{
				name: 'Tag',
				value: `${userInformation}`,
				inline: true,
			},
			{
				name: 'Joined Guild',
				value: `${userJoinedGuild}`,
				inline: true,
			},
			{
				name: 'Joined Discord',
				value: `${userJoinedDiscord}`,
				inline: true,
			},
			{
				name: 'Server Boosting',
				value: `${isUserServerBoosting}`,
				inline: true,
			},
			{
				name: 'Guild Roles',
				value: `${userRoles}`,
				inline: false,
			},
			{
				name: 'Badges',
				value: `${userBadges}`,
				inline: true,
			},
			{
				name: 'Moderator',
				value: `${isUserStaff}`,
				inline: true,
			},
			{
				name: 'Bot',
				value: `${isUserBot}`,
				inline: true,
			}
		)
		.setTimestamp()
		.setFooter({ text: FooterText, iconURL: FooterImage });

	await interaction.editReply({ embeds: [Embed] });
}

async function handleServerInformation(interaction) {
	// ... Server information logic
	// Deconstructing interaction
	const { guild, member, options, user, client, channel } = interaction;

	if (!guild)
		return await sendEmbed(
			interaction,
			'This command can only be used in a guild'
		);

	// fetch all guild members and store them in cache
	await guild.members.fetch();

	// Variables
	const guildName = guild.name;
	const guildCreated = `<t:${Math.round(
		new Date(guild.createdAt).getTime() / 1000
	)}:R>`;
	const guildOwner = `<@${guild.ownerId}>`;
	const guildDescription = guild.description || 'None';
	var guildAdmins =
		guild.members.cache
			.filter(
				(members) =>
					members.permissions.has(PermissionsBitField.Flags.Administrator) !==
						false &&
					members.user.bot === false &&
					members.id !== guild.ownerId
			)
			.map((members) => members.toString())
			.join(', ') || 'None';
	var guildMods =
		guild.members.cache
			.filter(
				(members) =>
					members.permissions.has(PermissionsBitField.Flags.ManageMessages) !==
						false &&
					members.user.bot === false &&
					members.id !== guild.ownerId &&
					members.permissions.has(PermissionsBitField.Flags.Administrator) ===
						false
			)
			.map((members) => members.toString())
			.join(', ') || 'None';

	// Guild Member Variables
	const guildMemberCount = guild.members.cache.filter(
		(member) => !member.user.bot
	).size;
	const guildBotCount = guild.members.cache.filter(
		(member) => member.user.bot
	).size;
	const guildTotalMemberCount = guild.memberCount;

	// Guild Channel Variables

	const guildTextChannelCount = guild.channels.cache.filter(
		(channel) => channel.type === ChannelType.GuildText
	).size;
	const guildVoiceChannelCount = guild.channels.cache.filter(
		(channel) => channel.type === ChannelType.GuildVoice
	).size;
	const guildThreadChannelCount = guild.channels.cache.filter(
		(channel) =>
			channel.type === ChannelType.PrivateThread && ChannelType.PublicThread
	).size;
	const guildCatagoryChannelCount = guild.channels.cache.filter(
		(channel) => channel.type === ChannelType.GuildCategory
	).size;
	const guildStageChannelCount = guild.channels.cache.filter(
		(channel) => channel.type === ChannelType.GuildStageVoice
	).size;
	const guildGuildAnnouncementCount = guild.channels.cache.filter(
		(channel) => channel.type === ChannelType.GuildAnnouncement
	).size;
	const guildTotalChannelCount = guild.channels.cache.size;

	// Guild Emoji & Stickers Variables

	const guildAnimatedEmojiCount = guild.emojis.cache.filter(
		(emoji) => emoji.animated
	).size;
	const guildStaticEmojiCount = guild.emojis.cache.filter(
		(emoji) => !emoji.animated
	).size;
	const guildStickersCount = guild.stickers.cache.size;
	const guildTotalEmojinStickersCount =
		guild.emojis.cache.size + guildStickersCount;

	// Guild Boost Variables
	const guildBoostLevel = guild.premiumTier;
	const guildBoostersCount = guild.premiumSubscriptionCount;
	var guildBoosters =
		guild.members.cache
			.filter((members) => members.premiumSince !== null)
			.map((members) => members.toString())
			.join(', ')
			.substring(0, 1000) || 'None';

	// Guild Role Variables
	const guildRoles =
		guild.roles.cache
			.sort((a, b) => b.position - a.position)
			.filter((role) => role.name !== '@everyone')
			.map((role) => role.toString())
			.join(', ')
			.substring(0, 1000) || 'None';
	const guildTotalRolesCount = guild.roles.cache.size - 1;

	let guildUserBadges = [];
	let counts = {};
	for (const member of guild.members.cache.values()) {
		const fetchedUser = await client.users.fetch(member.id);
		guildUserBadges = guildUserBadges.concat(fetchedUser.flags.toArray());
	}

	let totalBadges = 0;
	for (const badge of guildUserBadges) {
		if (counts[badge]) {
			counts[badge] += 1;
			totalBadges += 1;
		} else {
			counts[badge] = 1;
			totalBadges += 1;
		}
	}

	// Embed
	const Embed = new EmbedBuilder()
		.setColor(EmbedColour)
		.setAuthor({
			name: `Server Information for ${guildName}`,
			iconURL: guild.iconURL({ dynamic: true }),
		})
		.addFields(
			{
				name: 'General',
				value: [
					`Name: ${guildName}`,
					`Created: ${guildCreated}`,
					`Owner: ${guildOwner}`,
					`Admins: ${guildAdmins}`,
					`Mods: ${guildMods}`,
					`Description: ${guildDescription}`,
				].join('\n'),
				inline: false,
			},
			{
				name: 'Users',
				value: [
					`Members: ${guildMemberCount}`,
					`Bots: ${guildBotCount}`,
					`\nTotal: ${guildTotalMemberCount}`,
				].join('\n'),
				inline: false,
			},
			{
				name: 'Channels',
				value: [
					`- Text: ${guildTextChannelCount}`,
					`- Voice: ${guildVoiceChannelCount}`,
					`- Threads: ${guildThreadChannelCount}`,
					`- Categories: ${guildCatagoryChannelCount}`,
					`- Stages: ${guildStageChannelCount}`,
					`- News: ${guildGuildAnnouncementCount}`,
					`\nTotal: ${guildTotalChannelCount}`,
				].join('\n'),
				inline: false,
			},
			{
				name: 'Roles',
				value: [`${guildRoles}`, `\nTotal: ${guildTotalRolesCount}`].join('\n'),
				inline: false,
			},
			{
				name: 'Badges',
				value: [
					`- Active Developers: ${counts['ActiveDeveloper'] || 0}`,
					`- Bug Hunter Level 1: ${counts['BugHunterLevel1'] || 0}`,
					`- Bug Hunter Level 2: ${counts['BugHunterLevel2'] || 0}`,
					`- Certified Moderator: ${counts['CertifiedModerator'] || 0}`,
					`- House Bravery: ${counts['HypeSquadOnlineHouse1'] || 0}`,
					`- House Brilliance: ${counts['HypeSquadOnlineHouse2'] || 0}`,
					`- House Balance: ${counts['HypeSquadOnlineHouse3'] || 0}`,
					`- HypeSquad: ${counts['HypeSquad'] || 0}`,
					`- Parnter: ${counts['Parnter'] || 0}`,
					`- Early Supporter: ${counts['PremiumEarlySupporter'] || 0}`,
					`- Staff: ${counts['Staff'] || 0}`,
					`- Verified Bot: ${counts['VerifiedBot'] || 0}`,
					`- Verified Bot Developer: ${counts['VerifiedBotDeveloper'] || 0}`,
					`\nTotal: ${totalBadges}`,
				].join('\n'),
				inline: false,
			},
			{
				name: 'Emojis',
				value: [
					`- Animated: ${guildAnimatedEmojiCount}`,
					`- Static: ${guildStaticEmojiCount}`,
					`- Stickers: ${guildStickersCount}`,
					`\nTotal: ${guildTotalEmojinStickersCount}`,
				].join('\n'),
				inline: false,
			},
			{
				name: 'Nitro Statistics',
				value: [
					`- Tier: ${guildBoostLevel}`,
					`- Boosts: ${guildBoostersCount}`,
					`- Boosters: ${guildBoosters}`,
				].join('\n'),
				inline: false,
			}
		)
		.setTimestamp()
		.setFooter({ text: FooterText, iconURL: FooterImage });

	await interaction.editReply({ embeds: [Embed] });
}

async function handleBotInformation(interaction) {
	// ... Bot information logic
	// Deconstructing interaction
	const { guild, member, options, user, client, channel } = interaction;

	// Variables
	const botAvatar = client.user.avatarURL({ dynamic: true });
	const botUsername = client.user.username;
	const botDiscriminator = `#${client.user.discriminator}`;
	const botTag = `<@${client.user.id}>`;
	const botJoinedDiscord = `<t:${Math.round(
		new Date(client.user.createdAt).getTime() / 1000
	)}:R>`;
	let botRoles = 'None';
	if (guild) {
		if (guild.members.me.roles.cache.size > 1) {
			botRoles = guild.members.me.roles.cache
				.filter((role) => role.id !== guild.id)
				.map((role) => role.toString())
				.join(', ')
				.substring(0, 1000);
		}
	}
	const guilds = client.guilds.cache
		.map((guild) => guild.name)
		.join('\n')
		.substring(0, 1000);
	const botSlashCommands = client.commands
		.map(
			(command) =>
				`\`/${command.data.toJSON().name}\` | ${
					command.data.toJSON().description
				}`
		)
		.join('\n');
	// Performance Statistics Variables
	const botPercentageFreeRam = `${((os.freemem() * 100) / os.totalmem).toFixed(
		0
	)}%`;

	const botRamSpeed = `${os.cpus()[0].speed} MHz`;
	const botCpuCores = `${os.cpus().length}`;
	const botCpuModel = `${os.cpus()[0].model}`;
	const botSystemUptime = `${(os.uptime() / 60 / 60).toFixed(2)} Hours`;

	cpuStat.usagePercent(async function (err, percent, seconds) {
		if (err) {
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`• Error : ${err} •`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });
			interaction.reply({ embeds: [Embed] });
			return;
		}

		const memoryUsage = formatBytes(process.memoryUsage().heapUsed);
		const nodeVersion = process.version;
		const cpu = percent.toFixed(0);

		// Guild Statistics Variables
		const botPing = `${client.ws.ping}ms`;
		const botUptime = `<t:${Math.round(
			new Date(client.readyAt).getTime() / 1000
		)}:R>`;

		// Bot Invite Variable
		var botInvite;
		if (DeveloperMode === 'true')
			botInvite = `Developer bot cannot be invited to servers`;
		else
			botInvite = `[Invite link](${client.generateInvite({
				// permissions: [PermissionFlagsBits.Administrator],
				scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
			})})`;
		// Embed

		const Embed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setTitle('Bot Information')
			.setThumbnail(botAvatar)
			.addFields(
				{
					name: 'Username',
					value: botUsername,
					inline: true,
				},
				{
					name: 'Discriminator',
					value: botDiscriminator,
					inline: true,
				},
				{
					name: 'Tag',
					value: botTag,
					inline: true,
				},
				{
					name: 'Joined Discord',
					value: botJoinedDiscord,
					inline: true,
				},
				{
					name: 'Roles',
					value: botRoles,
					inline: false,
				},
				{
					name: 'Guilds',
					value: guilds,
				},
				{
					name: 'Total Guild Statistics',
					value: [
						`- Guilds: ${client.guilds.cache.size}`,
						`- Users: ${client.users.cache.size}`,
						`- Channels: ${client.channels.cache.size}`,
						`- Commands: ${client.commands.size}`,
						`- Ping: ${botPing}`,
						`- Uptime: ${botUptime}`,
					].join('\n'),
					inline: false,
				},
				{
					name: 'Performance Statistics',
					value: [
						`- RAM Usage: \`${botPercentageFreeRam}\``,
						`- RAM Speed: \`${botRamSpeed}\``,
						`- CPU Usage: \`${cpu}%\``,
						`- CPU Cores: \`${botCpuCores}\``,
						`- CPU Model: \`${botCpuModel}\``,
						`- Node Version: \`${nodeVersion}\``,
						`- System Uptime: \`${botSystemUptime}\``,
					].join('\n'),
					inline: false,
				},
				{
					name: 'Commands',
					value: botSlashCommands,
				},
				{
					name: 'Invite',
					value: botInvite,
				}
			)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });
		await interaction.editReply({ embeds: [Embed] });
	});

	function formatBytes(a, b) {
		let c = 1024;
		d = b || 2;
		e = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		f = Math.floor(Math.log(a) / Math.log(c));

		return parseFloat((a / Math.pow(c, f)).toFixed(d)) + ' ' + e[f];
	}
}

async function handleRoleInformation(interaction) {
	// ... Role information logic

	// Deconstructing interaction
	const { guild, member, options, user, client, channel } = interaction;

	// Variables
	const role = interaction.options.getRole('role');
	const roleID = role.id;
	const roleAvatar = role.iconURL() || FooterImage;
	const roleColour = role.hexColor;
	const roleCreatedAt = `<t:${Math.round(role.createdTimestamp / 1000)}:R>`;
	const roleMembers = role.members.size;
	const rolePermissions = role.permissions.toArray();
	const rolePermissionsFormatted = rolePermissions.join('\n');

	const RoleInformationEmbed = new EmbedBuilder()
		.setColor(EmbedColour)
		.setTitle('Role Information')
		.setThumbnail(roleAvatar)
		.addFields(
			{
				name: 'Name',
				value: `${role}`,
				inline: true,
			},
			{
				name: 'ID',
				value: `${roleID}`,
				inline: true,
			},
			{
				name: 'Colour',
				value: `${roleColour}`,
				inline: true,
			},
			{
				name: 'Created At',
				value: `${roleCreatedAt}`,
				inline: true,
			},
			{
				name: 'Members with Role',
				value: `${roleMembers || '0'}`,
				inline: true,
			},
			{
				name: 'Permissions',
				value: `${rolePermissionsFormatted || 'None'}`,
			}
		)
		.setTimestamp()
		.setFooter({ text: FooterText, iconURL: FooterImage });
	await interaction.editReply({ embeds: [RoleInformationEmbed] });
}
