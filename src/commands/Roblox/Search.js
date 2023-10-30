const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { FooterText, FooterImage, EmbedColour, RobloxAPIKey } = process.env;
const translate = require('@iamtraction/google-translate');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { sleep, cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const noblox = require('noblox.js');

module.exports = {
	cooldown: 10,
	data: new SlashCommandBuilder()
		.setName('lookup')
		.setDescription('Roblox Lookup.')
		.addStringOption((option) =>
			option
				.addChoices(
					{
						name: 'Username',
						value: 'user',
					},
					{
						name: 'Groupid',
						value: 'groupid',
					}
				)
				.setName('type')
				.setDescription('The type of lookup you would like to do.')
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('value')
				.setDescription('The username/groupid you would like to lookup.')
				.setRequired(true)
		),
	async execute(interaction) {
		const { member, options, user, client } = interaction;

		// Placeholder Embed
		await sendEmbed(interaction, `Getting User Information`);
		// await sleep(2000);
		const currentUser = await noblox.setCookie(RobloxAPIKey);
		console.log(`Logged in as ${currentUser.UserName} [${currentUser.UserID}]`);

		const userInput = options.getString('value');

		switch (options.getString('type')) {
			case 'user':
				noblox.getIdFromUsername(userInput).then((id) => {
					if (id) {
						noblox.getPlayerInfo(parseInt(id)).then(async (info) => {
							let joinDate = new Date(info.joinDate); // states join date
							// get timestamp from Date
							joinDate = `<t:${Math.floor(joinDate.getTime() / 1000)}:F>`;
							let imageUrl;
							let onlinePresence = await noblox.getPresences([id]);

							const userPresences = onlinePresence.userPresences;

							// Accessing values within the array
							var userPresenceType = userPresences[0].userPresenceType;
							const lastLocation = userPresences[0].lastLocation;
							// const placeId = userPresences[0].placeId || 'Unknown';
							const rootPlaceId = userPresences[0].rootPlaceId || 'Unknown';
							// const gameId = userPresences[0].gameId || 'Unknown';
							// const universeId = userPresences[0].universeId || 'Unknown';
							var lastOnline = new Date(userPresences[0].lastOnline);
							lastOnline = `<t:${Math.floor(lastOnline.getTime() / 1000)}:R>`;

							const RobloxSearchEmbed2 = new EmbedBuilder()
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });

							switch (userPresenceType) {
								case 0:
									userPresenceType = 'Offline';
									RobloxSearchEmbed2.setColor('Red');
									RobloxSearchEmbed2.addFields(
										{
											name: 'User Status',
											value: `${userPresenceType}`,
											inline: true,
										},
										{
											name: 'Last Seen',
											value: `${lastLocation}`,
											inline: true,
										},
										{
											name: 'Last Online',
											value: `${lastOnline}`,
											inline: true,
										}
									);
									break;
								case 1:
									userPresenceType = 'Online';
									RobloxSearchEmbed2.setColor('Blue');
									RobloxSearchEmbed2.addFields(
										{
											name: 'User Status',
											value: `${userPresenceType}`,
											inline: true,
										},
										{
											name: 'Last Seen',
											value: `${lastLocation}`,
											inline: true,
										},
										{
											name: 'Last Online',
											value: `${lastOnline}`,
											inline: true,
										}
									);
									break;
								case 2:
									userPresenceType = 'In-game';
									RobloxSearchEmbed2.setColor('Green');
									RobloxSearchEmbed2.addFields(
										{
											name: 'User Status',
											value: `${userPresenceType}`,
											inline: true,
										},
										{
											name: 'Last Online',
											value: `${lastOnline}`,
											inline: true,
										},
										{
											name: 'Last Seen',
											value: `${lastLocation}`,
											inline: false,
										},
										{
											name: 'Join Game',
											value: `[Click Here](https://roblox.com/games/${rootPlaceId})`,
											inline: true,
										}
									);
									break;
								case 3:
									userPresenceType = 'Studio';
									RobloxSearchEmbed2.setColor('Yellow');
									RobloxSearchEmbed2.addFields(
										{
											name: 'User Status',
											value: `${userPresenceType}`,
											inline: true,
										},
										{
											name: 'Last Updated',
											value: `${lastOnline}`,
											inline: true,
										}
										// {
										// 	name: 'Last Seen',
										// 	value: `${lastLocation}`,
										// 	inline: false,
										// }
									);
									break;
								default:
									userPresenceType = 'Unknown';
									userPresenceColour = 'Grey';
							}

							let thumbnail_circHeadshot = await noblox.getPlayerThumbnail(
								id,
								420,
								'png',
								true,
								'Headshot'
							);

							if (
								Array.isArray(thumbnail_circHeadshot) &&
								thumbnail_circHeadshot.length > 0
							) {
								imageUrl = thumbnail_circHeadshot[0].imageUrl;
							}

							let oldNames;
							if (Array.isArray(info.oldNames) && info.oldNames.length > 0) {
								oldNames = info.oldNames;
							} else {
								oldNames = 'None';
							}

							const RobloxSearchEmbed = new EmbedBuilder()
								.setURL(`https://roblox.com/users/${id}/profile`)
								.setTitle('Roblox Username Lookup')
								.setThumbnail(imageUrl)
								.addFields(
									{
										name: 'Username',
										value: `${info.username || 'No Username Found'}`,
										inline: true,
									},
									{
										name: 'Display Name',
										value: `${info.displayName || 'No Display Name Found'}`,
										inline: true,
									},
									{
										name: `User ID`,
										value: `${id || 'No User ID Found'}`,
										inline: true,
									},
									{
										name: 'Friends',
										value: `${info.friendCount || '0'}`,
										inline: true,
									},
									{
										name: 'Followers',
										value: `${info.followerCount || '0'}`,
										inline: true,
									},
									{
										name: 'Following',
										value: `${info.followingCount || '0'}`,
										inline: true,
									},
									{
										name: 'Blurb',
										value: `${info.blurb || 'No Blurb Found'}`,
									},
									{
										name: 'Account Age',
										value: `${info.age || 'No Account Age Found'} days`,
										inline: true,
									},
									{
										name: 'Register Date',
										value: `${joinDate || 'No Register Date Found'}`,
										inline: true,
									},
									{
										name: 'Previous Usernames',
										value: `${oldNames}`,
									}
								);

							interaction.editReply({
								embeds: [RobloxSearchEmbed, RobloxSearchEmbed2],
							});
						});
					} else {
						const RobloxSearchEmbed = new EmbedBuilder()
							.setTitle('Roblox Username Lookup')
							.setDescription('No User Found')
							.setColor('Red')
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						interaction.editReply({
							embeds: [RobloxSearchEmbed],
						});
					}
				});
				break;
			case 'groupid':
				const RobloxSearchEmbed2 = new EmbedBuilder()
					.setTitle('Roblox Username Lookup')
					.setDescription('Group Lookup is currently not supported.')
					.setColor('Red')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				interaction.editReply({
					embeds: [RobloxSearchEmbed2],
				});

				// check if input is a number
				if (isNaN(userInput)) {
					const RobloxSearchEmbed = new EmbedBuilder()

						.setTitle('Roblox Group Lookup')

						.setDescription('Please enter a valid group ID.')

						.setColor('Red')
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					interaction.editReply({
						embeds: [RobloxSearchEmbed],
					});
					return;
				}

				noblox.getGroup(parseInt(userInput)).then((group) => {
					if (group) {
						const RobloxSearchEmbed = new EmbedBuilder()

							.setTitle('Roblox Group Lookup')

							.setURL(`https://roblox.com/groups/${group.id}/about`)

							.addFields(
								{
									name: 'Name',
									value: `${group.name || 'No Group Name Found'}`,
									inline: true,
								},

								{
									name: 'ID',
									value: `${group.id || 'No Group ID Found'}`,
									inline: true,
								},

								{
									name: 'Description',
									value: `${group.description || 'No Group Owner Found'}`,
									inline: false,
								},
								{
									name: 'Owner Username',
									value: `${
										`@${group.owner.username}` || 'No Group Description Found'
									}`,
									inline: true,
								},

								{
									name: 'Owner Display Name',
									value: `${
										group.owner.displayName ||
										'No Group Owner Display Name Found'
									}`,
									inline: true,
								},

								{
									name: 'Owner ID',
									value: `${group.owner.userId || 'No Group Owner ID Found'}`,
									inline: true,
								},

								{
									name: 'Member Count',
									value: `${
										group.memberCount || 'No Group Member Count Found'
									}`,
									inline: true,
								},

								{
									name: 'Public Entry',
									value: `${group.publicEntryAllowed || 'false'}`,
									inline: true,
								}
							)

							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });

						interaction.editReply({
							embeds: [RobloxSearchEmbed],
						});
					} else {
						const RobloxSearchEmbed = new EmbedBuilder()
							.setTitle('Roblox Group Lookup')
							.setDescription('No Group Found')
							.setColor('Red')
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						interaction.editReply({
							embeds: [RobloxSearchEmbed],
						});
					}
				});

				break;
			default:
				const RobloxSearchEmbed = new EmbedBuilder()
					.setTitle('Roblox Username Lookup')
					.setDescription('Please select a valid lookup type')
					.setColor('Red')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				interaction.editReply({
					embeds: [RobloxSearchEmbed],
				});
		}
		// Variables
	},
};
