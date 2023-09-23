const {
	EmbedBuilder,
	Events,
	Message,
	AuditLogEvent,
	GuildChannel,
	ChannelType,
	GuildMember,
	User,
} = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const MemberLogs = require('../../../models/GuildMemberLogs.js');
const { type } = require('os');
const { Collection } = require('mongoose');
require('dotenv').config();
const {
	FooterImage,
	FooterText,
	DeveloperMode,
	PremiumUserRoleID,
	DeveloperGuildID,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;

module.exports = {
	name: Events.UserUpdate,
	nickname: 'User Logs',

	/**
	 * @param {User} oldUser
	 * @param {User} newUser
	 */
	async execute(oldUser, newUser) {
		console.log(`User Update Event Triggered`);
		// Deconstructing users
		const { client } = oldUser;

		// Find every guild the user is in from the User
		const guilds = client.guilds.cache.filter((guild) =>
			guild.members.cache.has(newUser.id)
		);

		// If the user is not in any guilds, return
		if (typeof guilds !== 'object') return console.log(`No guilds found`);

		// Changing Banner Doesn't Trigger Event

		// Get the number of guilds the user is in
		const newUserCommonGuilds = guilds.size;

		// Loop through every guild the user is in Collection
		for (const guildid of guilds) {
			console.log(`Guild ID: ${guildid[0]}`);

			const guild = guildid[1];

			// Getting message logs data from database
			const MemberLogsData = await MemberLogs.findOne({
				guild: guild.id,
			});

			// Checking if the guild has a message logs set up
			if (!MemberLogsData) {
				console.log(`No message logs found`);
				continue;
			}

			// Getting guild channel
			const channelToSend = guild.channels.cache.get(MemberLogsData.channel);

			// Checking if the channel exists
			if (!channelToSend) {
				await MemberLogs.findOneAndDelete({ guildId: guild.id });
				await sendEmbed(
					await guild.fetchOwner(),
					`Channel Missing: ${channelToSend} | Message Logs is now \`disabled\``
				);
				continue;
			}

			// Bot permissions
			const botPermissionsArry = ['SendMessages', 'ViewChannel'];
			const botPermissions = await permissionCheck(
				channelToSend,
				botPermissionsArry,
				client
			);

			// Checking if the bot has permissions
			if (!botPermissions[0]) {
				await MemberLogs.findOneAndDelete({ guildId: guild.id });
				await sendEmbed(
					await guild.fetchOwner(),
					`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
				).catch((err) => {});
				continue;
			}

			// Premium role check
			const premiumRole = client.guilds.cache
				.get(DeveloperGuildID)
				.roles.cache.get(PremiumUserRoleID);

			const hasPremiumRole = premiumRole.members.has(newUser.id)
				? `• ${SuccessEmoji} •`
				: `• ${ErrorEmoji} •`;

			const Embed = new EmbedBuilder()
				.setTitle(`User Updated`)
				.setColor('Orange')
				.addFields(
					{
						name: `Member`,
						value: `@${newUser.username} (${newUser})`,
						inline: true,
					},
					{
						name: 'User Premium',
						value: `${hasPremiumRole}`,
						inline: true,
					}
				)
				.setFooter({ text: FooterText, iconURL: FooterImage })
				.setTimestamp();

			// Variables
			const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

			const newUserAvatar = newUser.avatar;
			const oldUserAvatar = oldUser.avatar;

			if (newUserAvatar !== oldUserAvatar) {
				var avatarURL = newUser.avatarURL({ dynamic: true });
				if (avatarURL === null) {
					avatarURL = `No Avatar Found`;
				} else {
					avatarURL = `[Click Here](${avatarURL})`;
					Embed.setImage(newUser.avatarURL({ dynamic: true, size: 1024 }));
				}
				Embed.addFields({
					name: 'Avatar Changed',
					value: `${avatarURL}`,
					inline: false,
				});
			}

			// // Banner
			// if (newUserBanner !== oldUserBanner) {
			// 	var bannerURL = newUser.bannerURL({ dynamic: true });
			// 	if (bannerURL === null) {
			// 		bannerURL = `No Avatar Found`;
			// 	} else {
			// 		bannerURL = `[Click Here](${bannerURL})`;
			// 		Embed.setImage(newUser.bannerURL({ dynamic: true, size: 1024 }));
			// 	}
			// 	Embed.addFields({
			// 		name: 'New Avatar',
			// 		value: `${avatarURL}`,
			// 		inline: false,
			// 	});
			// }
			const newUserDisplayName = newUser.displayName;
			const oldUserDisplayName = oldUser.displayName;

			if (newUserDisplayName !== oldUserDisplayName) {
				if (oldUserDisplayName === null)
					oldUserDisplayName = `@${oldUser.username}`;
				if (newUserDisplayName === null)
					newUserDisplayName = `@${newUser.username}`;
				Embed.addFields({
					name: 'Display Name Changed',
					value: `\`${oldUserDisplayName}\` -> \`${newUserDisplayName}\``,
					inline: false,
				});
			}

			const newUserAvatarDecoration = newUser.avatarDecoration;
			const oldUserAvatarDecoration = oldUser.avatarDecoration;

			if (newUserAvatarDecoration !== oldUserAvatarDecoration) {
				var avatarDecoration = newUser.avatarDecorationURL({ dynamic: true });
				if (oldUserAvatarDecoration === null)
					oldUserAvatarDecoration = `No Avatar Decoration Found`;
				if (avatarDecoration === null)
					avatarDecoration = `No Avatar Decoration Found`;
				else {
					avatarDecoration = `[Click Here](${avatarDecoration})`;
					Embed.setImage(
						newUser.avatarDecorationURL({ dynamic: true, size: 1024 })
					);
				}

				Embed.addFields({
					name: 'Avatar Decoration Changed',
					value: `${oldUserAvatarDecoration} -> ${avatarDecoration}`,
					inline: false,
				});
			}

			// Adding last fields to embed
			Embed.addFields(
				{
					name: 'Updated At',
					value: currentTime,
				},
				{
					name: "ID's",
					value: `\`\`\`User | ${newUser.id}\nGuild | ${guild.id}\`\`\``,
				}
			);

			// Sending embed
			await channelToSend.send({ embeds: [Embed] });
		}
	},
};
