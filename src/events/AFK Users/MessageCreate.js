const { ActivityType, Events, EmbedBuilder, Message } = require('discord.js');
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
	 */

	async execute(message) {
		const { client, guild, member, channel, content, author } = message;
		// Checking if the command is being used in a guild and if the author is a bot
		if (!guild || author.bot) return;

		// Bot permissions
		const botPermissionsArry = ['ViewChannel', 'SendMessages'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) return;

		// get the mentioned users
		const mentionedUsers = message.mentions.users;

		// how to check if there is data in a collection
		if (mentionedUsers.size === 0) return;

		// get the data from the database
		const afkUsers = await GuildAFKUsers.findOne({
			guild: guild.id,
		});

		// if there is no data in the database
		if (!afkUsers) return;

		// if there is data in the database check that the mentioned users are not afk
		for (const mentionedUser of mentionedUsers.values()) {
			const isMentionedUserAFK = afkUsers.users.includes(mentionedUser.id);
			// console.log(
			// 	`Mentioned User : @${mentionedUser.username} | AFK Status : ${isMentionedUserAFK}`
			// );
			if (isMentionedUserAFK) {
				const embed = new EmbedBuilder()
					.setDescription(`<@${mentionedUser.id}> is currently afk.`)
					.setColor(EmbedColour)
					.setTimestamp()
					.setFooter({
						text: `${client.user.username} | AFK`,
						iconURL: client.user.displayAvatarURL(),
					});

				return channel.send({ embeds: [embed] });
			}
		}
	},
};
