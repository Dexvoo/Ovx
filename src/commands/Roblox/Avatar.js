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
const RobloxVerifiedUsers = require('../../models/VerifiedUsers.js');
const noblox = require('noblox.js');

module.exports = {
	cooldown: 5,
	catagory: 'Roblox',
	helpUsage: '<roblox|discord|search> <user>',
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
		// const currentUser = await noblox.setCookie(RobloxAPIKey);
		// console.log(`Logged in as ${currentUser.UserName} [${currentUser.UserID}]`);

		const subcommand = options.getSubcommand();

		switch (subcommand) {
			case 'roblox':
				var targetUserRoblox = options.getUser('user');
				if (!targetUserRoblox) targetUserRoblox = user;

				// get data from database
				const robloxVerifiedUsersData = await RobloxVerifiedUsers.findOne({
					discordUserId: targetUserRoblox.id,
				});

				if (!robloxVerifiedUsersData?.robloxUserId)
					return await sendEmbed(
						interaction,
						`${targetUserRoblox} is not verified, please advise them to use the command \`/verify roblox\``
					);

				const userInfo = await noblox.getPlayerInfo(
					parseInt(robloxVerifiedUsersData.robloxUserId)
				);

				if (!userInfo) {
					return await sendEmbed(
						interaction,
						`The user \`${robloxVerifiedUsersData.robloxUsername}\` does not exist, please advise them to use the command \`/verify roblox\``
					);
				}

				const avatar = await noblox.getAvatar(
					robloxVerifiedUsersData.robloxUserId
				);

				if (!avatar) {
					return await sendEmbed(
						interaction,
						`Could not get avatar for \`${robloxVerifiedUsersData.robloxUsername}\``
					);
				} else if (avatar === 'Rate Limited') {
					return await sendEmbed(
						interaction,
						`I am currently rate limited, please try again later.`
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
					.setTitle(`@${userInfo.username} Avatar`)
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
			case 'discord':
				var targetUserDiscord = options.getUser('user');
				// Variables

				// Checking If The User Is Valid
				if (!targetUserDiscord) {
					targetUserDiscord = user;
				}

				targetUserDiscord.avatar

				// Buttons
				const LinkButton = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setLabel('PNG')
						.setURL(
							targetUserDiscord.displayAvatarURL({
								size: 1024,
								extension: 'png',
							})
						),
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setLabel('JPG')
						.setURL(
							targetUserDiscord.displayAvatarURL({
								size: 1024,
								extension: 'jpg',
							})
						),
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setLabel('GIF')
						.setURL(
							targetUserDiscord.displayAvatarURL({
								dynamic: true,
								size: 1024,
							})
						)
				);

				// sends embed
				const Embed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setAuthor({
						name: `@${targetUserDiscord.username}'s Avatar`,
						iconURL: targetUserDiscord.displayAvatarURL({ dynamic: true }),
					})
					.setImage(
						targetUserDiscord.displayAvatarURL({
							dynamic: true,
							size: 4096,
						})
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				interaction.editReply({
					embeds: [Embed],
					components: [LinkButton],
				});
				break;

			case 'search':
				const username = options.getString('value');
				let userId = await noblox.getIdFromUsername(username);

				if (!userId) {
					return await sendEmbed(
						interaction,
						`The user \`${username}\` does not exist`
					);
				}

				const userInfo2 = await noblox.getPlayerInfo(parseInt(userId));

				if (!userInfo2) {
					return await sendEmbed(
						interaction,
						`The user \`${username}\` does not exist`
					);
				}

				const avatar2 = await noblox.getAvatar(userId);

				if (!avatar2) {
					return await sendEmbed(
						interaction,
						`Could not get avatar for \`${username}\``
					);
				} else if (avatar2 === 'Rate Limited') {
					return await sendEmbed(
						interaction,
						`I am currently rate limited, please try again later.`
					);
				}

				console.log(`avatar2: ${avatar2}`);

				let imageUrl2;

				let thumbnail_circHeadshot2 = await noblox.getPlayerThumbnail(
					userId,
					420,
					'png',
					true,
					'Body'
				);

				if (
					Array.isArray(thumbnail_circHeadshot2) &&
					thumbnail_circHeadshot2.length > 0
				) {
					imageUrl2 = thumbnail_circHeadshot2[0].imageUrl;
				}

				const SearchEmbed = new EmbedBuilder()
					.setURL(`https://roblox.com/users/${userId}/profile`)
					.setTitle(`@${userInfo2.username} Avatar`)
					.setImage(imageUrl2)
					.addFields(
						{
							name: 'Scales',
							value: `Height: ${avatar2.scales.height}\nWidth: ${avatar2.scales.width}\nHead: ${avatar2.scales.head}\nDepth: ${avatar2.scales.depth}\nProportion: ${avatar2.scales.proportion}`,
							inline: true,
						},
						{
							name: 'Body Colors',
							value: `Head: ${avatar2.bodyColors.headColorId}\nTorso:${avatar2.bodyColors.torsoColorId}\nRight Arm:${avatar2.bodyColors.rightArmColorId}\nRight Arm:${avatar2.bodyColors.leftArmColorId}\nLeft Leg:${avatar2.bodyColors.rightLegColorId}\nRight Leg:${avatar2.bodyColors.leftLegColorId}`,
							inline: true,
						}
					)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });

				// List assest from avatar and check for types
				var assetList = avatar2.assets;
				const accessoryUrls2 = [];
				const accessoryNames2 = [];
				const accessoryTypes2 = [];
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
						accessoryNames2.push(asset.name);
						accessoryTypes2.push(asset.assetType.name);
						accessoryUrls2.push(`https://www.roblox.com/catalog/${asset.id}`);
					}
				});

				// Get Accessories
				var accessoriesList = '';
				for (let i = 0; i < accessoryNames2.length; i++) {
					accessoriesList += `${accessoryTypes2[i].replace(
						'Accessory',
						''
					)}: [${accessoryNames2[i]}](${accessoryUrls2[i]})\n`;
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

				SearchEmbed.addFields({
					name: 'Assets',
					value: `Shirt: [${shirtName}](${shirtUrl})\nPants: [${pantsName}](${pantsUrl})\n${accessoriesList}`,
					inline: false,
				});

				interaction.editReply({
					embeds: [SearchEmbed],
				});

				break;

			default:
				break;
		}
	},
};
