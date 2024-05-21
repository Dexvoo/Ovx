const { ActivityType, Events, EmbedBuilder } = require('discord.js');
const GuildInviteDetection = require('../../models/GuildInviteDetection.js');
const { EmbedColour } = process.env;
const { sendEmbed } = require('../../utils/Embeds.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');

module.exports = {
	name: Events.MessageCreate,
	once: false,
	nickname: 'Invite Detection',

	/**
	 * @param {Message} message
	 * @param {Client} client
	 */

	async execute(message) {
		const { client, guild, member, channel, content, author } = message;
		// Checking if the command is being used in a guild and if the author is a bot
		if (!guild || author.bot) return;

		const guildInviteDetection = await GuildInviteDetection.findOne({
			guildId: guild.id,
		});

		if (!guildInviteDetection) return;

		const botPermissionsArry = ['ManageMessages', 'SendMessages', 'ViewChannel'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			return;
		}

		const inviteRegex =
			/discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi;
		const inviteRegexExec = inviteRegex.exec(content);

		if (!inviteRegexExec) return;

		const inviteCode = inviteRegexExec[1];

		const invite = await client.fetchInvite(inviteCode).catch(() => false);

		if (!invite) {
			cleanConsoleLogData('Invite Detection', 'Invite not found', 'info');
		}

		if (!invite.guild) return;

		if (invite.guild.id === guild.id) return;

		await message.delete();

		const embed = new EmbedBuilder()
			.setTitle('Invite Detected')
			.setColor(EmbedColour)
			.setDescription(`${member} has sent an invite, message has been removed.`)
			.setTimestamp();

		channel.send({ embeds: [embed] });
	},
};
