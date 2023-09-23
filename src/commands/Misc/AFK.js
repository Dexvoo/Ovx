const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const AFKUsers = require('../../models/GuildAFKUsers.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
} = process.env;
require('dotenv').config();

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('afk')
		.setDescription('Sets your AFK status.')
		.setDMPermission(false),

	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		// Deconstructing interaction
		const { guild, member, options, user, client, channel } = interaction;

		await sendEmbed(interaction, 'Setting AFK status');
		await sleep(2000);

		// Checking if the user is in a guild
		if (!(await guildCheck(guild))) return;

		// Variables
		const query = { guild: guild.id };
		const afkUsers = await AFKUsers.exists(query);

		// Check if user exists in database
		if (!afkUsers) {
			const newAFKUser = new AFKUsers({
				guild: guild.id,
				users: [user.id],
			});
			await newAFKUser.save().catch((error) => console.log(error));
			await sendEmbed(interaction, 'You are now AFK');
			return;
		}

		const afkUsersData = await AFKUsers.findOne(query);
		// checks database data and checks if user is already afk
		if (afkUsersData.users.includes(user.id)) {
			await sendEmbed(interaction, 'You are already AFK');
			return;
		}

		// adds user to database
		afkUsersData.users.push(user.id);
		await afkUsersData.save().catch((error) => console.log(error));

		// sends embed
		await sendEmbed(interaction, 'You are now AFK');
	},
};
