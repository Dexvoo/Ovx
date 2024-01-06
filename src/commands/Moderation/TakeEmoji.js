const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
require('dotenv').config();

module.exports = {
	cooldown: 5,
	catagory: 'Moderation',
	data: new SlashCommandBuilder()
		.setName('emoji')
		.setDescription('Take/edit/delete an emoji from a guild.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('take')
				.setDescription('Take an emoji from a guild.')
				.addStringOption((option) =>
					option
						.setName('emoji')
						.setDescription('The emoji you would like to take.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('emoji2')
						.setDescription('The emoji you would like to take.')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('emoji3')
						.setDescription('The emoji you would like to take.')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('emoji4')
						.setDescription('The emoji you would like to take.')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('emoji5')
						.setDescription('The emoji you would like to take.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('edit')
				.setDescription('Edit an emoji from a guild.')
				.addStringOption((option) =>
					option
						.setName('emoji')
						.setDescription('The emoji you would like to edit.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('The new name of the emoji.')
						.setRequired(true)
				)
		)

		.addSubcommand((subcommand) =>
			subcommand
				.setName('delete')
				.setDescription('Delete an emoji from a guild.')
				.addStringOption((option) =>
					option
						.setName('emoji')
						.setDescription('The emoji you would like to delete.')
						.setRequired(true)
				)
		),
	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		// how would i defer the reply and then edit it later?
		await interaction.deferReply();

		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// names of all guilds the bot is in
			const guilds = client.guilds.cache.map((guild) => guild.name);
			console.log(guilds);

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Bot permissions
			const botPermissionsArry = ['ManageGuildExpressions'];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0])
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);

			// User permissions
			const userPermissionsArry = ['ManageGuildExpressions'];
			const userPermissions = await permissionCheck(
				interaction,
				userPermissionsArry,
				member
			);

			if (!userPermissions[0])
				return await sendEmbed(
					interaction,
					`User Missing Permissions: \`${userPermissions[1]}\``
				);

			await sendEmbed(interaction, 'Attempting to take emoji`s');
			await sleep(2000);

			// Get emoji
			const emoji = options.getString('emoji');

			// Check if emoji is valid
			const emojiCheck = parseEmoji(emoji);

			if (!emojiCheck.id)
				return await sendEmbed(interaction, 'Invalid emoji provided');

			const subcommand = options.getSubcommand();
			switch (subcommand) {
				case 'take':
					const emoji = options.getString('emoji');
					const emoji2 = options.getString('emoji2');
					const emoji3 = options.getString('emoji3');
					const emoji4 = options.getString('emoji4');
					const emoji5 = options.getString('emoji5');
					const guildBoostLevel = guild.premiumTier;
					var allEmojis = [];
					var takenEmojis = [];
					var maxGuildEmojis = 50;
					const guildAnimatedEmojis = guild.emojis.cache.filter(
						(emoji) => emoji.animated
					).size;
					const guildStaticEmojis = guild.emojis.cache.filter(
						(emoji) => !emoji.animated
					).size;

					// Making sure the emojis is valid
					if (emoji !== null) allEmojis.push(emoji);
					if (emoji2 !== null) allEmojis.push(emoji2);
					if (emoji3 !== null) allEmojis.push(emoji3);
					if (emoji4 !== null) allEmojis.push(emoji4);
					if (emoji5 !== null) allEmojis.push(emoji5);

					// Getting guild emoji limits
					if (guildBoostLevel === 1) maxGuildEmojis = 100;
					if (guildBoostLevel === 2) maxGuildEmojis = 150;
					if (guildBoostLevel === 3) maxGuildEmojis = 250;

					// Checking if the guild has enough emoji slots
					if (guildAnimatedEmojis > maxGuildEmojis - allEmojis.length)
						return await sendEmbed(
							interaction,
							`This guild has reached the maximum amount of animated emojis allowed. (\`${maxGuildEmojis}\`)`
						);
					if (guildStaticEmojis >= maxGuildEmojis - allEmojis.length)
						return await sendEmbed(
							interaction,
							`This guild has reached the maximum amount of static emojis allowed. (\`${maxGuildEmojis}\`)`
						);

					// Looping through the emojis that is valid
					for (let i = 0; i < allEmojis.length; i++) {
						await sleep(100);
						let emoji = parseEmoji(allEmojis[i]);
						let emojiId = emoji.id;

						if (!emojiId) {
							await sendEmbed(
								interaction,
								`Invalid emoji: \`${allEmojis[i]}\``
							);
							await sleep(5000);
							continue;
						}

						// Variables
						let emojiName = `OVX_${emoji.name}`;
						let extention = emoji.animated ? '.gif' : '.png';
						let emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}${extention}`;

						// Creating the emoji
						try {
							await guild.emojis
								.create({ attachment: emojiUrl, name: emojiName })
								.catch((error) => {
									console.error(error);
									return sendErrorEmbed(interaction, error);
								})
								.then((newEmoji) => {
									takenEmojis.push(newEmoji);
								});
						} catch (error) {
							console.error(error);
							await sendErrorEmbed(interaction, error);
							return await sendEmbed(
								interaction,
								`There was an error creating the emoji: \`${emojiName}\``
							);
						}
					}

					// Sending embed
					await sendEmbed(
						interaction,
						`Created ${takenEmojis.length} emojis: ${takenEmojis.join(' • ')}`
					);
					break;
				case 'edit':
					const guildCheck = verifyEmojiGuild(guild, emojiCheck.id);

					if (!guildCheck)
						return await sendEmbed(interaction, 'Emoji is not from this guild');

					const newEmojiName = options.getString('name');

					if (!verifyEmojiName(newEmojiName))
						return await sendEmbed(
							interaction,
							'Emoji name is to long or short'
						);

					// Edit emoji
					const newEmoji = await guild.emojis.edit(emojiCheck.id, {
						name: newEmojiName,
					});

					await sendEmbed(interaction, `Emoji edited ${newEmoji}`);

					break;
				case 'delete':
					const guildCheck2 = verifyEmojiGuild(guild, emojiCheck.id);

					if (!guildCheck2)
						return await sendEmbed(interaction, 'Emoji is not from this guild');

					// Delete emoji
					await guild.emojis.delete(emojiCheck.id);

					await sendEmbed(interaction, `Emoji deleted \`${emojiCheck.name}\``);
					break;
			}
		} catch (error) {
			console.error(error);
			await sendErrorEmbed(interaction, error);
			await sendEmbed(
				interaction,
				`There was an error running this command\n\n${error}`
			);
			return;
		}
	},
};

function verifyEmojiName(emojiName) {
	if (emojiName.length > 32) return false;
	return true;
}

function verifyEmojiGuild(guild, emojiId) {
	const guildEmojis = guild.emojis.cache.map((emoji) => emoji.id);
	if (guildEmojis.includes(emojiId)) return true;
	return false;
}
