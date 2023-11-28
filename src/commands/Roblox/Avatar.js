// const {
// 	SlashCommandBuilder,
// 	EmbedBuilder,
// 	ButtonStyle,
// 	ButtonBuilder,
// 	ActionRowBuilder,
// } = require('discord.js');
// const { FooterText, FooterImage, EmbedColour, RobloxAPIKey } = process.env;
// const translate = require('@iamtraction/google-translate');
// const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
// const { sleep, cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
// const RobloxVerifiedUsers = require('../../models/RobloxVerifiedUsers.js');
// const noblox = require('noblox.js');

// module.exports = {
// 	cooldown: 5,
// 	data: new SlashCommandBuilder()
// 		.setName('avatar')
// 		.setDescription('Get a roblox avatar.')
// 		.addSubcommand((subcommand) =>
// 			subcommand
// 				.setName('roblox')
// 				.setDescription('Get your roblox avatar.')
// 				.addUserOption((option) =>
// 					option
// 						.setName('user')
// 						.setDescription('The user you would like to get the avatar of.')
// 						.setRequired(false)
// 				)
// 		)
// 		.addSubcommand((subcommand) =>
// 			subcommand
// 				.setName('discord')
// 				.setDescription('Get your discord avatar.')
// 				.addUserOption((option) =>
// 					option
// 						.setName('user')
// 						.setDescription('The user you would like to get the avatar of.')
// 						.setRequired(false)
// 				)
// 		)
// 		.addSubcommand((subcommand) =>
// 			subcommand
// 				.setName('search')
// 				.setDescription('Search for a roblox user.')
// 				.addStringOption((option) =>
// 					option
// 						.setName('value')
// 						.setDescription('The username you would like the avatar of.')
// 						.setRequired(true)
// 				)
// 		),
// 	async execute(interaction) {
// 		const { member, options, user, client } = interaction;

// 		// Placeholder Embed
// 		await sendEmbed(interaction, `Getting User Information`);
// 		// await sleep(2000);
// 		const currentUser = await noblox.setCookie(RobloxAPIKey);
// 		console.log(`Logged in as ${currentUser.UserName} [${currentUser.UserID}]`);

// 		const subcommand = options.getSubcommand();

// 		switch (subcommand) {
// 			case 'roblox':
// 				var targetUserRoblox = options.getUser('user');
// 				if (!targetUserRoblox) {
// 					targetUserRoblox = user;
// 				}

// 				break;

// 			default:
// 				break;
// 		}

// 	},
// };
