const { ActivityType, Events, EmbedBuilder } = require('discord.js');
const GuildAFKUsers = require('../../models/GuildAFKUsers.js');
const { EmbedColour } = process.env;
const { sendEmbed } = require('../../utils/Embeds.js');
const { permissionCheck } = require('../../utils/Checks.js');

module.exports = {
	name: Events.MessageCreate,
	once: false,
	nickname: 'AFK Users',

	/**
	 * @param {Message} message
	 * @param {Client} client
	 */

	async execute(message) {
		const { client, guild, member, channel, content, author } = message;
		// Checking if the command is being used in a guild and if the author is a bot
		if (!guild || author.bot)
			return console.log('Message is not in a guild or is a bot');

		console.log(
			'--------------------------------------------------------------------------------------'
		);

		// Bot permissions
		const botPermissionsArry = ['ViewChannel', 'SendMessages'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` | AFK Users`
			);
		}

		const afkUsers = await GuildAFKUsers.findOne({
			guild: guild.id,
		});

		if (!afkUsers) return console.log('No AFK Users in database');

		console.log('AFK Users in database');

		const AFKUser = afkUsers.users.find((user) => user === author.id);

		if (!AFKUser) return console.log('User is not AFK');

		console.log('User is AFK');

		const embed = new EmbedBuilder()
			.setTitle('AFK')
			.setDescription(
				`Welcome back <@${author.id}>! I have removed you from the afk list.`
			)
			.setColor(EmbedColour)
			.setTimestamp()
			.setFooter({
				text: `${client.user.username} | AFK`,
				iconURL: client.user.displayAvatarURL(),
			});

		channel.send({ embeds: [embed] });

		afkUsers.users.splice(afkUsers.users.indexOf(AFKUser), 1);
		await afkUsers.save().catch((error) => console.log(error));

		console.log('User removed from AFK database');
	},
};
