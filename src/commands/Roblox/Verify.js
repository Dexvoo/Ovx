const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { FooterText, FooterImage, EmbedColour, RobloxAPIKey } = process.env;
const translate = require('@iamtraction/google-translate');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { sleep, cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const VerifyInformation = require('../../models/VerifiedUsers.js');
const { getRandomReadableWords } = require('../../utils/GetVerifyNames.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const noblox = require('noblox.js');
const { getUser } = require('../../utils/osu/getUser.js');

// how would i put words in a seperate file and import it?

module.exports = {
	cooldown: 10,
	catagory: 'Roblox',
	helpUsage: 'NA',
	data: new SlashCommandBuilder()
		.setName('verify')
		.setDescription('Verify your accounts')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('roblox')
				.setDescription('Verify your Roblox account')
				.addStringOption((option) =>
					option
						.setName('username')
						.setDescription('The username you would like to verify as')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('osu')
				.setDescription('Verify your Osu! account')
				.addStringOption((option) =>
					option
						.setName('username')
						.setDescription('The username you would like to verify as')
						.setRequired(true)
				)
		),

	/**
	 * @param {CommandInteraction} interaction
	 */

	async execute(interaction) {
		const { member, options, user, client } = interaction;


		// check bot permissions to see channel
		const botPermissionsArry = ['SendMessages', 'ViewChannel'];
		const botPermissions = await permissionCheck(
			interaction.channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			interaction.reply(
				`Bot Missing Permissions: \`${botPermissions[1].join(', ')}\``
			);
			return;
		}


		// Placeholder Embed
		await sendEmbed(interaction, `Starting Verification Process`);
		await sleep(2000);

		switch (options.getSubcommand()) {
			case 'roblox':
				// get database
				const RobloxVerifiedUsers = await VerifyInformation.findOne({
					discordUserId: user.id,
				});

				if (RobloxVerifiedUsers?.robloxUserId) {
					const embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`Roblox Verification`)
						.setDescription(
							`You are already verified! Your Roblox id is \`${RobloxVerifiedUsers.robloxUserId}\``
						)
						.setTimestamp()
						.setFooter({
							text: FooterText,
							iconURL: FooterImage,
						});
					return await interaction.editReply({
						embeds: [embed],
					});
				}

				noblox
					.getIdFromUsername(options.getString('username'))
					.then(async (foundUser) => {
						const userId = foundUser;
						if (!userId) {
							await sendEmbed(
								interaction,
								`That username is invalid! Please try again later.`
							);
							setTimeout(async () => {
								// fetch reply message
								const reply = await interaction.fetchReply().catch(() => {
									return false;
								});

								if (reply) await reply.delete();
							}, 5000);
							return;
						}
						const string = getRandomReadableWords();
						const ConfirmationButton = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setStyle(ButtonStyle.Primary)
								.setLabel('Confirm')
								.setCustomId('Confirmation')
						);

						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setTitle(`Roblox Verification`)
							.setDescription(
								`To prove you own the account, copy and paste the profile description into your roblox bio!\n\nOnce you have done this, click the button below to verify your account.`
							)
							.addFields(
								{
									name: 'Profile Description',
									value: `\`${string}\``,
								},
								{
									name: 'Profile Link',
									value: `https://www.roblox.com/users/${userId}/profile`,
									inline: false,
								}
							)
							.setTimestamp()
							.setFooter({
								text: 'This prompt will cancel in 10 mins',
								iconURL: FooterImage,
							});

						interaction.editReply({
							embeds: [Embed],
							components: [ConfirmationButton],
						});

						// Button Collector
						const buttonFilter = (button) => button.clicker.user.id === user.id;
						const buttonCollector =
							interaction.channel.createMessageComponentCollector({
								buttonFilter,
								time: 600000,
								max: 1,
								maxProcessed: 1,
								errors: ['time'],
							});

						buttonCollector.on('collect', async (button) => {
							if (button.customId === 'Confirmation') {
								button.deferUpdate();

								const embed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setTitle(`Roblox Verification`)
									.setDescription(
										`Checking if you have put the string in your profile description.`
									)
									.setTimestamp()
									.setFooter({
										text: FooterText,
										iconURL: FooterImage,
									});

								await interaction.editReply({
									embeds: [embed],
									components: [],
								});

								await sleep(3000);

								// Fetching the user's profile description
								const profileDescription = await noblox
									.getPlayerInfo(userId)
									.then((info) => info.blurb);

								const userName = await noblox
									.getPlayerInfo(userId)
									.then((info) => info.username);

								// Checking if the user has put the string in their profile description
								if (profileDescription.includes(string)) {
									// Adding the verified role

									// await member.roles.add('1165778063209005207');

									// Fetching the user's Roblox avatar
									var avatarURL;
									let thumbnail_circHeadshot = await noblox.getPlayerThumbnail(
										userId,
										420,
										'png',
										true,
										'Headshot'
									);

									if (
										Array.isArray(thumbnail_circHeadshot) &&
										thumbnail_circHeadshot.length > 0
									) {
										avatarURL = thumbnail_circHeadshot[0].imageUrl;
									}

									// Adding the user to the database
									await VerifyInformation.findOneAndUpdate(
										{
											discordUserId: user.id,
										},
										{
											discordUserId: user.id,
											robloxUserId: userId,
										},
										{
											upsert: true,
										}
									);

									// Embed
									const Embed = new EmbedBuilder()
										.setColor(EmbedColour)
										.setTitle(`Roblox Verification`)
										.setAuthor({
											name: `@${userName}'s Avatar`,
											iconURL: avatarURL,
										})
										.setThumbnail(avatarURL)
										.setDescription(
											`You have successfully verified your account!`
										)
										.setTimestamp()
										.setFooter({ text: FooterText, iconURL: FooterImage });

									// Sending the embed
									await interaction.editReply({
										embeds: [Embed],
										components: [],
									});
								} else {
									const Embed = new EmbedBuilder()
										.setColor(EmbedColour)
										.setTitle(`Roblox Verification`)
										.setDescription(
											`You have not put the string in your profile description! Please try again later.`
										)
										.setTimestamp()
										.setFooter({
											text: FooterText,
											iconURL: FooterImage,
										});

									interaction.editReply({
										embeds: [Embed],
										components: [],
									});

									setTimeout(async () => {
										// fetch reply message
										const reply = await interaction.fetchReply().catch(() => {
											return false;
										});

										if (reply) await reply.delete();
									}, 5000);
									return;
								}
							}
						});
						buttonCollector.on('end', async (collected, reason) => {
							if (reason === 'time') {
								const Embed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setTitle(`Roblox Verification`)
									.setDescription(
										`You took too long to respond! Please try again later.`
									)
									.setTimestamp()
									.setFooter({
										text: FooterText,
										iconURL: FooterImage,
									});

								interaction.editReply({
									embeds: [Embed],
									components: [],
								});

								setTimeout(async () => {
									const reply = await interaction.fetchReply().catch(() => {
										return false;
									});
									if (reply) await reply.delete();
								}, 5000);
								return;
							}
						});
					})
					.catch(async (err) => {
						console.log(err);
						await sendEmbed(
							interaction,
							`That username is invalid! Please try again later. error: \`${err}\``
						);

						setTimeout(async () => {
							// fetch reply message
							const reply = await interaction.fetchReply().catch(() => {
								return false;
							});

							if (reply) await reply.delete();
						}, 5000);
						return;
					});

				break;
			case 'osu':
				// get database

				const OsuVerifiedUsers = await VerifyInformation.findOne({
					discordUserId: user.id,
				});

				console.log(OsuVerifiedUsers);

				if (OsuVerifiedUsers?.osuUserId) {
					const embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`Osu! Verification`)
						.setDescription(
							`You are already verified! Your Osu! id is \`${OsuVerifiedUsers.osuUserId}\``
						)
						.setTimestamp()
						.setFooter({
							text: FooterText,
							iconURL: FooterImage,
						});
					return await interaction.editReply({
						embeds: [embed],
					});
				}

				const username = options.getString('username');

				// check that the username is valid
				const userInformation = await getUser(username);

				if (!userInformation) {
					await sendEmbed(
						interaction,
						`That username is invalid! Please try again later.`
					);
					setTimeout(async () => {
						// fetch reply message
						const reply = await interaction.fetchReply().catch(() => {
							return false;
						});

						if (reply) return await reply.delete();
					}, 5000);
				}

				const string = getRandomReadableWords();

				const ConfirmationButton = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Primary)
						.setLabel('Confirm')
						.setCustomId('OsuConfirmation')
				);

				const Embed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setTitle(`Osu! Verification`)
					.setDescription(
						`To prove you own the account please put the following in your profile description.\n\nOnce you have done this, click the button below to verify your account.`
					)
					.addFields(
						{
							name: 'Profile Link',
							value: `https://osu.ppy.sh/users/${username}`,
							inline: false,
						},
						{
							name: 'Profile Description',
							value: `\`${string}\``,
						}
					)
					.setTimestamp()
					.setFooter({
						text: 'This prompt will cancel in 10 mins',
						iconURL: FooterImage,
					});

				await interaction.editReply({
					embeds: [Embed],
					components: [ConfirmationButton],
				});

				// Button Collector
				const buttonFilter = (button) => button.clicker.user.id === user.id;
				const buttonCollector =
					interaction.channel.createMessageComponentCollector({
						buttonFilter,
						time: 600000,
						max: 1,
						maxProcessed: 1,
						errors: ['time'],
					});

				buttonCollector.on('collect', async (button) => {
					if (button.customId === 'OsuConfirmation') {
						button.deferUpdate();

						const embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setTitle(`Osu! Verification`)
							.setDescription(
								`Checking if you have put the string in your profile description.`
							)
							.setTimestamp()
							.setFooter({
								text: FooterText,
								iconURL: FooterImage,
							});

						await interaction.editReply({
							embeds: [embed],
							components: [],
						});

						await sleep(3000);

						// Fetching the user's profile description

						const userInformation = await getUser(username);
						const profileDescription = userInformation.page.html;
						const userId = userInformation.id;
						const userName = userInformation.username;
						const avatar_url = userInformation.avatar_url;

						// Checking if the user has put the string in their profile description
						if (profileDescription.includes(string)) {
							// edit the database with the new information not new entry
							await VerifyInformation.findOneAndUpdate(
								{
									discordUserId: user.id,
								},
								{
									discordUserId: user.id,
									osuUserId: userId,
								},
								{
									upsert: true,
								}
							);

							// Embed
							const Embed = new EmbedBuilder()
								.setColor(EmbedColour)
								.setAuthor({
									name: `@${userName}'s Avatar`,
									iconURL: avatar_url,
									url: `https://osu.ppy.sh/users/${userId}`,
								})
								.setThumbnail(avatar_url)
								.setTitle(`Osu! Verification`)
								.setDescription(`You have successfully verified your account!`)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });

							// Sending the embed
							await interaction.editReply({
								embeds: [Embed],
								components: [],
							});
						} else {
							const Embed = new EmbedBuilder()
								.setColor(EmbedColour)
								.setTitle(`Osu! Verification`)
								.setDescription(
									`You have not put the string in your profile description! Please try again later.`
								)
								.setTimestamp()
								.setFooter({
									text: FooterText,
									iconURL: FooterImage,
								});

							interaction.editReply({
								embeds: [Embed],
								components: [],
							});

							setTimeout(async () => {
								// fetch reply message
								const reply = await interaction.fetchReply().catch(() => {
									return false;
								});

								if (reply) await reply.delete();
							}, 5000);
							return;
						}
					}
				});

				break;

			default:
				break;
		}
	},
};
