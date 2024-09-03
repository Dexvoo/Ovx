const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const UserCurrency = require('../../models/UserCurrency.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
	SuccessEmoji,
	ErrorEmoji,
	CloudConvertAPIKey,
} = process.env;
require('dotenv').config();

module.exports = {
	cooldown: 0,
	catagory: 'Developer',
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('developer test command.')
		.setDMPermission(false),

	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			const { guild, member, options, client, channel } = interaction;
			if (member.user.id !== '387341502134878218') {
				await sendEmbed(
					interaction,
					'You do not have permission to use this command.'
				);
			}

			const listOfGuilds = client.guilds.cache.filter(
				(guild) => guild.ownerId === '387341502134878218'
			);

			const listOfGuildsArray = listOfGuilds.map(
				(guild) => `${guild.name} | ${guild.id}\n`
			);

			const listOfGuildsString = listOfGuildsArray.join('');

			const embed = new EmbedBuilder()
				.setTitle('Guilds')
				.setDescription(listOfGuildsString)
				.setColor(EmbedColour)
				.setTimestamp()
				.setFooter({
					text: `${client.user.username} | Guilds`,
					iconURL: client.user.displayAvatarURL(),
				});

			await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.log(error);
		}
	},
};
