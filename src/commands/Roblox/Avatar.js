const {
	SlashCommandBuilder,
	EmbedBuilder,
	ButtonStyle,
	ButtonBuilder,
	ActionRowBuilder,
	CommandInteraction,
} = require('discord.js');
const { FooterText, FooterImage, EmbedColour, RobloxAPIKey } = process.env;
const translate = require('@iamtraction/google-translate');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { sleep, cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const RobloxVerifiedUsers = require('../../models/RobloxVerifiedUsers.js');
const noblox = require('noblox.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('avatar')
		.setDescription('Get a roblox avatar.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('roblox')
				.setDescription('Get your roblox avatar.')
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('The user you would like to get the avatar of.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('discord')
				.setDescription('Get your discord avatar.')
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('The user you would like to get the avatar of.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('search')
				.setDescription('Search for a roblox user.')
				.addStringOption((option) =>
					option
						.setName('value')
						.setDescription('The username you would like the avatar of.')
						.setRequired(true)
				)
		),
	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		const { member, options, user, client } = interaction;

		// Placeholder Embed
		await sendEmbed(interaction, `Getting User Information`);
		// await sleep(2000);
		const currentUser = await noblox.setCookie(RobloxAPIKey);
		console.log(`Logged in as ${currentUser.UserName} [${currentUser.UserID}]`);

		const subcommand = options.getSubcommand();

		switch (subcommand) {
			case 'roblox':
				var targetUserRoblox = options.getUser('user');
				if (!targetUserRoblox) {
					targetUserRoblox = user;
				}

				// get data from database
				const robloxVerifiedUsersData = await RobloxVerifiedUsers.findOne({
					discordUserId: targetUserRoblox.id,
				});

				if (!robloxVerifiedUsersData) {
					return await sendEmbed(
						interaction,
						`${targetUserRoblox} is not verified, please advise them to use the command \`/verify\``
					);
				}

				console.log(`robloxVerifiedUsersData: ${robloxVerifiedUsersData}`);
				const userInfo = await noblox.getPlayerInfo(
					parseInt(robloxVerifiedUsersData.robloxUserId)
				);

				console.log(`userInfo: ${userInfo}`);

				const avatar = await noblox.getAvatar(
					robloxVerifiedUsersData.robloxUserId
				);

				console.log(`avatar: ${avatar}`);

				console.log(userInfo);

				if (!userInfo) {
					return await sendEmbed(
						interaction,
						`The user \`${robloxVerifiedUsersData.robloxUsername}\` does not exist, please reverify 2`
					);
				}

				let imageUrl;

				let thumbnail_circHeadshot = await noblox.getPlayerThumbnail(
					robloxVerifiedUsersData.robloxUserId,
					420,
					'png',
					true,
					'Body'
				);

				if (
					Array.isArray(thumbnail_circHeadshot) &&
					thumbnail_circHeadshot.length > 0
				) {
					imageUrl = thumbnail_circHeadshot[0].imageUrl;
				}

				const VerifiedEmbed = new EmbedBuilder()
					.setURL(
						`https://roblox.com/users/${robloxVerifiedUsersData.robloxUserId}/profile`
					)
					.setTitle(`@${info.username} Avatar`)
					.setImage(imageUrl)
					.addFields(
						{
							name: 'Scales',
							value: `Height: ${avatar.scales.height}\nWidth: ${avatar.scales.width}\nHead: ${avatar.scales.head}\nDepth: ${avatar.scales.depth}\nProportion: ${avatar.scales.proportion}`,
							inline: true,
						},
						{
							name: 'Body Colors',
							value: `Head: ${avatar.bodyColors.headColorId}\nTorso:${avatar.bodyColors.torsoColorId}\nRight Arm:${avatar.bodyColors.rightArmColorId}\nRight Arm:${avatar.bodyColors.leftArmColorId}\nLeft Leg:${avatar.bodyColors.rightLegColorId}\nRight Leg:${avatar.bodyColors.leftLegColorId}`,
							inline: true,
						}
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });

				// List assest from avatar and check for types
				var assetList = avatar.assets;
				const accessoryUrls = [];
				const accessoryNames = [];
				const accessoryTypes = [];
				var shirtName;
				var shirtUrl;
				var pantsName;
				var pantsUrl;
				assetList.map((asset) => {
					if (asset.assetType.name === 'Shirt') {
						shirtName = asset.name;
						shirtUrl = `https://www.roblox.com/catalog/${asset.id}`;
					}

					if (asset.assetType.name === 'Pants') {
						pantsName = asset.name;
						pantsUrl = `https://www.roblox.com/catalog/${asset.id}`;
					}

					if (asset.assetType.name.includes('Accessory')) {
						accessoryNames.push(asset.name);
						accessoryTypes.push(asset.assetType.name);
						accessoryUrls.push(`https://www.roblox.com/catalog/${asset.id}`);
					}
				});

				// Get Accessories
				var accessoriesList = '';
				for (let i = 0; i < accessoryNames.length; i++) {
					accessoriesList += `${accessoryTypes[i].replace('Accessory', '')}: [${
						accessoryNames[i]
					}](${accessoryUrls[i]})\n`;
				}

				if (shirtName === undefined) {
					shirtName = 'No Shirt';
					shirtUrl = 'https://www.roblox.com/catalog/0';
				}

				if (pantsName === undefined) {
					pantsName = 'No Pants';
					pantsUrl = 'https://www.roblox.com/catalog/0';
				}

				// Link Accessories in a string

				VerifiedEmbed.addFields({
					name: 'Assets',
					value: `Shirt: [${shirtName}](${shirtUrl})\nPants: [${pantsName}](${pantsUrl})\n${accessoriesList}`,
					inline: false,
				});

				interaction.editReply({
					embeds: [VerifiedEmbed],
				});

				break;

			default:
				break;
		}
	},
};
