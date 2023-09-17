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
const { FooterText, FooterImage, EmbedColour, ErrorChannelID } = process.env;
const { permissionCheck, guildCheck } = require('./Checks.js');

/**
 * @param {CommandInteraction | GuildChannel | GuildMember} interactionChannelMember - Interaction / Channel / Member
 * @param {String} description - GuildMember or Client
 */
const sendEmbed = async (interactionChannelMember, description) => {
	if (!interactionChannelMember) throw new Error('No interaction provided.');
	if (!description) throw new Error('No description provided.');
	if (interactionChannelMember instanceof CommandInteraction) {
		const { replied, deferred } = interactionChannelMember;
		if (replied) {
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`• ${description} •`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });
			await interactionChannelMember.editReply({
				embeds: [Embed],
				ephemeral: false,
			});
			return true;
		} else if (deferred) {
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`• ${description} •`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });
			await interactionChannelMember.followUp({
				embeds: [Embed],
				ephemeral: false,
			});
			return true;
		} else {
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(`• ${description} •`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });
			await interactionChannelMember.reply({
				embeds: [Embed],
				ephemeral: false,
			});
			return true;
		}
	} else if (interactionChannelMember instanceof GuildChannel) {
		// check channel permissions
		const botPermissions = ['ViewChannel', 'SendMessages'];
		if (
			!(await permissionCheck(
				interactionChannelMember,
				botPermissions,
				interactionChannelMember.client
			))
		) {
			console.log(
				`Bot Missing Permissions | ${botPermissions.join(', ')}} | #${
					interactionChannelMember.name
				}`
			);
			return false;
		}

		const Embed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setDescription(`• ${description} •`)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });
		await interactionChannelMember.send({ embeds: [Embed], ephemeral: false });
		return true;
	} else if (interactionChannelMember instanceof GuildMember) {
		const Embed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setDescription(`• ${description} •`)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });
		const message = await interactionChannelMember
			.send({ embeds: [Embed] })
			.catch((error) => {
				console.log(`${interactionChannelMember.user.username} | ${error}`);
			});

		if (!message) return false;
		return true;
		// member.send the embed
	} else {
		throw new Error('Invalid interaction or channel provided.');
	}
};

const sendErrorEmbed = async (interaction, error) => {
	if (!interaction) throw new Error('No interaction provided.');
	if (!error) throw new Error('No error provided.');

	var { client, guild, user } = interaction;

	if (!client) throw new Error('No client found.');
	if (!guild) {
		guild = { name: `${user.username}'s DM ` };
	}

	const errorChannel = client.channels.cache.get(ErrorChannelID);
	if (!errorChannel) throw new Error('No error channel found.');

	const ErrorEmbed = new EmbedBuilder()
		.setColor('#FF0000')
		.setDescription(`• Error has been found in **${guild.name}** •`)
		.addFields(
			{
				name: 'Error Message',
				value: `${error.rawError.message}`,
				inline: false,
			},
			{
				name: 'Error Code',
				value: `${error.code}`,
				inline: false,
			},
			{
				name: 'Error Status',
				value: `${error.status}`,
				inline: false,
			},
			{
				name: 'Error Method',
				value: `${error.method}`,
				inline: false,
			},
			{
				name: 'Error URL',
				value: `${error.url}`,
				inline: false,
			}
		)
		.setTimestamp()
		.setFooter({ text: FooterText, iconURL: FooterImage });
	errorChannel.send({
		content: '<@387341502134878218>',
		embeds: [ErrorEmbed],
	});
};

module.exports = {
	sendEmbed,
	sendErrorEmbed,
};
