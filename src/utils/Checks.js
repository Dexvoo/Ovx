const {
	EmbedBuilder,
	CommandInteraction,
	PermissionFlagsBits,
	PermissionsBitField,
	GuildMember,
	GuildChannel,
	Client,
} = require('discord.js');
require('dotenv').config();
const { sendEmbed, sendErrorEmbed } = require('./Embeds.js');
/**
 * @param {CommandInteraction} interaction
 */
const guildCheck = async (interaction) => {
	if (!interaction) throw new Error('No interaction provided.');

	const { guild } = interaction;
	if (!guild) {
		await sendEmbed(interaction, 'Please use this command in a guild.');
		return false;
	}
	return true;
};

/**
 * @param {CommandInteraction} interactionChannel - Interaction or Channel
 * @param {Array} permissions - Array of Permissions to check
 * @param {GuildMember | Client} member - GuildMember or Client
 */
const permissionCheck = async (interactionChannel, permissions, member) => {
	// Check for undefined
	if (!interactionChannel) throw new Error('No user or bot provided.');
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
	} else if (interactionChannel instanceof GuildChannel) {
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
			console.log(
				`${userOrBot} Missing Permission : \`${permissions[i]}\` in channel : ${channel}`
			);

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
