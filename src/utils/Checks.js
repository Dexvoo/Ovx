const {
	EmbedBuilder,
	CommandInteraction,
	PermissionFlagsBits,
	PermissionsBitField,
	GuildMember,
	VoiceBasedChannel,
	GuildChannel,
	Client,
	Guild,
} = require('discord.js');
require('dotenv').config();
const { sendEmbed } = require('./Embeds.js');
/**
 * @param {Guild} guild
 */
const guildCheck = async (guild) => {
	if (!guild) {
		await sendEmbed(interaction, 'Please use this command in a guild.');
		return false;
	}
	return true;
};

/**
 * @param {CommandInteraction | VoiceBasedChannel } interactionChannel - Interaction or Channel
 * @param {Array} permissions - Array of Permissions to check
 * @param {GuildMember | Client} member - GuildMember or Client
 */
const permissionCheck = async (interactionChannel, permissions, member) => {
	// Check for undefined
	if (!interactionChannel) throw new Error('No channel/interaction provided.');
	if (!permissions) throw new Error('No permissions provided.');
	if (!member) throw new Error('No member provided.');

	// Variables
	var channel;
	var userPermissions;
	var userOrBot;
	var guild;

	// Getting channel and guild from interaction or channel
	if (interactionChannel instanceof CommandInteraction) {
		channel = interactionChannel.channel;
		guild = interactionChannel.guild;
	} else if (
		interactionChannel instanceof GuildChannel ||
		interactionChannel instanceof VoiceBasedChannel
	) {
		channel = interactionChannel;
		guild = channel.guild;
	}

	// Getting permissions for user or bot
	if (member instanceof GuildMember) {
		userPermissions = member.permissionsIn(channel);
		userOrBot = 'User';
	} else if (member instanceof Client) {
		userPermissions = guild.members.me.permissionsIn(channel);
		userOrBot = 'Bot';
	} else {
		throw new Error('Invalid member provided.');
	}

	// Checking permissions and return true or false
	var falsePermissions = [];
	for (let i = 0; i < permissions.length; i++) {
		if (!userPermissions.has(permissions[i])) {
			falsePermissions.push(permissions[i]);
		}
	}

	if (falsePermissions.length > 0) {
		return [false, falsePermissions];
	}

	return [true];
};

module.exports = {
	guildCheck,
	permissionCheck,
};
