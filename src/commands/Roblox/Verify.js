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
const VerifyInformation = require('../../models/RobloxVerifiedUsers.js');
const { getRandomReadableWords } = require('../../utils/GetVerifyNames.js');
const noblox = require('noblox.js');

// how would i put words in a seperate file and import it?

module.exports = {
	cooldown: 10,
	catagory: 'Roblox',
	helpUsage: 'NA',
	data: new SlashCommandBuilder()
		.setName('verify')
		.setDescription('Roblox verify.'),

	/**
	 * @param {CommandInteraction} interaction
	 */

	async execute(interaction) {
		const { member, options, user, client } = interaction;

		// Placeholder Embed
		await sendEmbed(interaction, `Starting Verification Process`);
		await sleep(2000);

		// if (member.roles.cache.has('1165778063209005207'))
		// 	return await sendEmbed(interaction, `You are already verified!`);
		// get database
		const RobloxVerifiedUsers = await VerifyInformation.findOne({
			discordUserId: user.id,
		});

		if (RobloxVerifiedUsers) {
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

		// add a message collector to check if the user is verified
		const filter = (m) => m.author.id === user.id;
		const Collector = interaction.channel.createMessageCollector({
			filter,
			time: 12000,
			max: 1,
			maxProcessed: 1,
			errors: ['time'],
		});

		const embed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setTitle(`Roblox Verification`)
			.setDescription(`What is your Roblox Username?`)
			.setTimestamp()
			.setFooter({
				text: 'This message will be inactive in 2 minutes.',
				iconURL: FooterImage,
			});

		interaction.editReply({
			embeds: [embed],
		});

		Collector.on('collect', async (message) => {
			noblox
				.getIdFromUsername(message.content)
				.then(async (foundUser) => {
					message.delete();
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
							`To prove you own the account please put the following in your profile description.\n\nOnce you have done this, click the button below to verify your account.`
						)
						.addFields(
							{
								name: 'Profile Link',
								value: `https://www.roblox.com/users/${userId}/profile`,
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
								const newRobloxVerifiedUser = new VerifyInformation({
									discordUserId: user.id,
									robloxUserId: userId,
								});

								await newRobloxVerifiedUser.save();

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
		});

		Collector.on('end', async (collected, reason) => {
			if (reason === 'time') {
				await sendEmbed(
					interaction,
					`You took too long to respond! Please try again later.`
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
		});

		// const currentUser = await noblox.setCookie(RobloxAPIKey);

		// Variables
	},
};
