const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const UserCurrency = require('../../models/UserCurrency.js');
const { xpBoosterPercentage } = require('../../utils/AddXP.js');
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

			if(!guild) return;

			
			const xpBoosterPercentageValue = await xpBoosterPercentage(member);

			console.log(`xpBoosterPercentage: ${xpBoosterPercentageValue}`);
			
			
			const roles = guild.roles.cache

		
			const randomRole = roles.random();

			const members = randomRole.members;

			console.log(members.size);
			

			const embed = new EmbedBuilder()
				.setTitle(`Members of random role < ${randomRole.name} >`)
				.setDescription(`Number Of Members: ${members.size}\n${members.map(member => `${member.user.username} | ${member.user.id}`).join('\n')}`)
				.setColor(EmbedColour)
				.setTimestamp()
				.setFooter({
					text: `${client.user.username} | Guilds`,
					iconURL: FooterImage,
				});

			await interaction.reply({ embeds: [embed], ephemeral: true });
		} catch (error) {
			console.log(error);
		}
	},
};
