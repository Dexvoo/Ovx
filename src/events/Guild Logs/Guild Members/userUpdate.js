const { EmbedBuilder, Events, User } = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');
const MemberLogs = require('../../../models/GuildMemberLogs.js');
const {
	cleanConsoleLog,
	cleanConsoleLogData,
} = require('../../../utils/ConsoleLogs.js');
require('dotenv').config();
const {
	FooterImage,
	FooterText,
	DeveloperGuildID,
	PremiumUserRoleID,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;

/**
 * @param {User} oldUser
 * @param {User} newUser
 */

// Function to handle user updates
async function handleUserUpdate(client, oldUser, newUser, MemberLogsData) {
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

	const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

	if (newUser.avatar !== oldUser.avatar) {
		const avatarURL =
			newUser.avatarURL({ dynamic: true, size: 1024 }) || 'No Avatar Found';

		if (avatarURL !== 'No Avatar Found') {
			Embed.setImage(avatarURL);
			Embed.addFields({
				name: 'Avatar Changed',
				value: `[Click Here](${avatarURL})`,
				inline: false,
			});
		} else {
			Embed.addFields({
				name: 'Avatar Changed',
				value: avatarURL,
				inline: false,
			});
		}
	}

	const newUserDisplayName = newUser.displayName || `@${newUser.username}`;
	const oldUserDisplayName = oldUser.displayName || `@${oldUser.username}`;

	if (newUserDisplayName !== oldUserDisplayName) {
		Embed.addFields({
			name: 'Display Name Changed',
			value: `\`${oldUserDisplayName}\` -> \`${newUserDisplayName}\``,
			inline: false,
		});
	}

	if (newUser.username !== oldUser.username) {
		Embed.addFields({
			name: 'Username Changed',
			value: `\`@${oldUser.username}\` -> \`@${newUser.username}\``,
			inline: false,
		});
	}

	if (newUser.discriminator !== oldUser.discriminator) {
		Embed.addFields({
			name: 'Discriminator Changed',
			value: `\`${oldUser.discriminator}\` -> \`${newUser.discriminator}\``,
			inline: false,
		});
	}

	if (newUser.premiumType !== oldUser.premiumType) {
		Embed.addFields({
			name: 'Nitro Status Changed',
			value: `\`${oldUser.premiumType}\` -> \`${newUser.premiumType}\``,
			inline: false,
		});
	}

	Embed.addFields({
		name: 'Updated At',
		value: currentTime,
	});

	return Embed;
}

module.exports = {
	name: Events.UserUpdate,
	nickname: 'User Logs',

	async execute(oldUser, newUser) {
		try {
			cleanConsoleLogData('User Update', `@${newUser.username}`, 'info');

			const { client } = oldUser;
			const guilds = client.guilds.cache.filter((guild) =>
				guild.members.cache.has(newUser.id)
			);

			if (guilds.size === 0) return;

			for (const guild of guilds.values()) {
				const MemberLogsData = await MemberLogs.findOne({ guild: guild.id });

				if (!MemberLogsData) {
					cleanConsoleLogData(
						'User Update',
						`Guild: ${guild.name} | Member Logs Not Setup`,
						'warning'
					);
					continue;
				}

				const channelToSend = guild.channels.cache.get(MemberLogsData.channel);

				if (!channelToSend) {
					await MemberLogs.findOneAndDelete({ guildId: guild.id });
					cleanConsoleLogData(
						'User Update',
						`Guild: ${guild.name} | Member Logs Channel Missing`,
						'warning'
					);
					await sendEmbed(
						await guild.fetchOwner(),
						`Channel Missing: ${channelToSend} | Member Logs is now disabled`
					);
					continue;
				}

				const botPermissionsArry = ['SendMessages', 'ViewChannel'];
				const botPermissions = await permissionCheck(
					channelToSend,
					botPermissionsArry,
					client
				);

				if (!botPermissions[0]) {
					await MemberLogs.findOneAndDelete({ guildId: guild.id });
					cleanConsoleLogData(
						'User Update',
						`Guild: ${guild.name} | Incorrect Channel Permissions`,
						'warning'
					);
					await sendEmbed(
						await guild.fetchOwner(),
						`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Member Logs is now \`disabled\``
					).catch((err) => {});
					continue;
				}

				const Embed = await handleUserUpdate(
					client,
					oldUser,
					newUser,
					MemberLogsData
				);

				Embed.addFields({
					name: "ID's",
					value: `\`\`\`ansi\n[0;31mUser | ${newUser.id}\n[0;34mGuild | ${guild.id}\`\`\``,
				});

				await channelToSend.send({ embeds: [Embed] });
			}

			cleanConsoleLogData(
				'User Update',
				`${guilds.map((guild) => guild.name).join(' | ')}`,
				'info'
			);
		} catch (error) {
			console.log(error);
		}
	},
};
