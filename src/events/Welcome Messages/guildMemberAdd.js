const { GuildMember, EmbedBuilder } = require('discord.js');
const { sendEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const WelcomeMessages = require('../../models/WelcomeMessages');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText, DeveloperMode } = process.env;

module.exports = {
	name: 'guildMemberAdd',
	nickname: 'Welcome Messages',

	/**
	 *  @param {GuildMember} member
	 */
	async execute(member) {
		// Deconstructing member
		const { guild, user, client } = member;
		if (DeveloperMode == 'true')
			return console.log(
				`[EVENT] ${this.nickname} | [USER] @${user.username} | [Guild] ${guild.name}`
			);

		// Variables
		const waveGifs = [
			'https://media.giphy.com/media/QrhV2RTdTc4il2CUJK/giphy.gif',
			'https://media.giphy.com/media/USk4m5E7YIlbAYStR3/giphy.gif',
			'https://media.giphy.com/media/evEgbkGON3VJ2YrGjM/giphy.gif',
			'https://media.giphy.com/media/NOwzAkUad1ctDeW3IJ/giphy.gif',
			'https://media.giphy.com/media/771OgXlgcRVjsT8V3F/giphy.gif',
			'https://media.giphy.com/media/fIsdUaLEh9Sy6sUpr3/giphy.gif',
			'https://media.giphy.com/media/3ov9jIYPU7NMT6TS7K/giphy.gif',
			'https://media.giphy.com/media/zddQncCovkOEOMnc27/giphy.gif',
			'https://media.giphy.com/media/NW7LJhqot08kdB0ih4/giphy.gif',
			'https://media.giphy.com/media/H1vRCfj8YyWlqauDmX/giphy.gif',
		];
		const randomWaveGif = waveGifs[Math.floor(Math.random() * waveGifs.length)];
		const query = { guild: guild.id };
		const getWelcomeMessageData = await WelcomeMessages.findOne(query);

		// If nothing in database return
		if (!getWelcomeMessageData) return console.log('No data in database');

		// Deconstructing getWelcomeMessageData
		const { channel, message, role } = getWelcomeMessageData;
		const welcomeMessagesChannel = guild.channels.cache.get(channel);
		const welcomeMessagesRole = guild.roles.cache.get(role);
		var welcomeMessagesMessage = message;

		// If no channel return
		if (!welcomeMessagesChannel)
			return sendEmbed(
				await member.guild.fetchOwner(),
				`Channel Missing | \`Welcome Channel\` | \`/setup welcome\``
			);

		// Bot Permissions
		const botPermissionsArry = ['SendMessages', 'ViewChannel', 'ManageRoles'];
		const botPermissions = await permissionCheck(
			welcomeMessagesChannel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0])
			return await sendEmbed(
				await member.guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1].join(
					' | '
				)}\` ${welcomeMessagesChannel}`
			).catch(() => {});

		if (welcomeMessagesMessage == null)
			welcomeMessagesMessage = `Welcome to the server ${user}!`;

		if (welcomeMessagesRole) {
			if (!welcomeMessagesRole.editable) {
				// Delete role from database
				getWelcomeMessageData.role = null;
				await getWelcomeMessageData.save();

				return await sendEmbed(
					await member.guild.fetchOwner(),
					`Bot Missing Permissions: \`Manage Roles\` ${welcomeMessagesChannel}`
				).catch(() => {});
			}

			// Add role to user
			await member.roles.add(welcomeMessagesRole).catch(() => {});
		}

		// Send embed
		const embed = new EmbedBuilder()
			.setAuthor({
				name: `@${user.username}`,
				iconURL: user.displayAvatarURL({ dynamic: true }),
			})
			.setTitle(`Welcome to ${guild.name}`)
			.setDescription(welcomeMessagesMessage)
			.setImage(randomWaveGif)
			.setColor(EmbedColour)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });

		await welcomeMessagesChannel
			.send({ content: `${member}`, embeds: [embed] })
			.catch(() => {});
	},
};
