const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	cooldown: 5,
	catagory: 'Moderation',
	data: new SlashCommandBuilder()
		.setName('automod')
		.setDescription('Add automod rules to your server.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('flagged_words')
				.setDescription('Block profanity, sexual content, and slurs.')
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('spam_messages')
				.setDescription('Block messages suspected of spam.')
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('spam_mentions')
				.setDescription('Block messages with excessive mentions.')
				.addIntegerOption((option) =>
					option
						.setName('amount')
						.setDescription('The amount of mentions to block.')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('keywords')
				.setDescription('Block a given word in the server.')
				.addStringOption((option) =>
					option
						.setName('word')
						.setDescription('The word to block.')
						.setRequired(true)
				)
		),

	/**
	 *
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;
			const subcommand = options.getSubcommand();

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Bot permissions
			const botPermissionsArry = ['ManageGuild'];
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
			const userPermissionsArry = ['Administrator'];
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

			await sendEmbed(interaction, 'Attempting to create rule');
			await sleep(2000);

			switch (subcommand) {
				case 'flagged_words':
					// check for rules with the trigger type 4
					const rules = await guild.autoModerationRules.fetch();
					const existingRule = rules.find((rule) => rule.triggerType === 4);
					if (existingRule) {
						await sendEmbed(
							interaction,
							'This rule already exists so rule has been removed'
						);

						// delete the rule
						await existingRule.delete();
						return;
					}

					// create the rule
					const rule = await guild.autoModerationRules
						.create({
							name: `Block profanity, sexual content, and slurs | Prevented by @${client.user.username} Automoderation`,
							creatorId: '1149737617013870622',
							enabled: true,
							eventType: 1,
							triggerType: 4,
							triggerMetadata: {
								presets: [1, 2, 3],
							},
							actions: [
								{
									type: 1,
									metadata: {
										channel: channel,
										durationSeconds: 10,
										customMessage:
											'This message was prevented by Ovx Automoderation',
									},
								},
							],
						})
						.catch(async (error) => {
							await sendErrorEmbed(interaction, error);
							await sendEmbed(interaction, `\`${error}\``);
						});

					if (!rule) return;

					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Automod')
						.setDescription(`**Rule Created** : \`${rule.name}\``)
						.setColor(EmbedColour)
						.setTimestamp()
						.setFooter({
							text: FooterText,
							iconURL: FooterImage,
						});

					await interaction.editReply({ embeds: [Embed] });

					break;

				case 'keywords':
					const word = options.getString('word');

					// create the rule
					const rule2 = await guild.autoModerationRules
						.create({
							name: `Word Prevention : ${word} | Prevented by @${client.user.username} Automoderation`,
							creatorId: '1149737617013870622',
							enabled: true,
							eventType: 1,
							triggerType: 1,
							triggerMetadata: {
								keywordFilter: [word],
							},
							actions: [
								{
									type: 1,
									metadata: {
										channel: channel,
										durationSeconds: 10,
										customMessage:
											'This message was prevented by Ovx Automoderation',
									},
								},
							],
						})
						.catch(async (error) => {
							await sendErrorEmbed(interaction, error);
							await sendEmbed(interaction, `\`${error}\``);
						});

					if (!rule2) return;

					const Embed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Automod')
						.setDescription(
							`Successfully created a automod rule, this rule will prevent the word \`${word}\` from being used.\n\n**Rule Name:** \`${rule2.name}\`\n**Rule ID:** \`${rule2.id}\``
						)
						.setColor(EmbedColour)
						.setTimestamp()
						.setFooter({
							text: FooterText,
							iconURL: FooterImage,
						});

					await interaction.editReply({ embeds: [Embed2] });

					break;

				case 'spam_messages':
					// create the rule
					const rule3 = await guild.autoModerationRules
						.create({
							name: `Spam Mentions Prevention : ${amount} | Prevented by @${client.user.username} Automoderation`,
							creatorId: '1149737617013870622',
							enabled: true,
							eventType: 1,
							triggerType: 3,
							triggerMetadata: {
								// keywordFilter: [word],
							},
							actions: [
								{
									type: 1,
									metadata: {
										channel: channel,
										durationSeconds: 10,
										customMessage:
											'This message was prevented by Ovx Automoderation',
									},
								},
							],
						})
						.catch(async (error) => {
							await sendErrorEmbed(interaction, error);
							await sendEmbed(interaction, `\`${error}\``);
						});

					if (!rule3) return;

					const Embed3 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Automod')
						.setDescription(
							`Successfully created a automod rule, this rule will prevent spam messages from being used.\n\n**Rule Name:** \`${rule3.name}\`\n**Rule ID:** \`${rule3.id}\``
						)
						.setColor(EmbedColour)
						.setTimestamp()
						.setFooter({
							text: FooterText,
							iconURL: FooterImage,
						});

					await interaction.editReply({ embeds: [Embed3] });

					break;
				case 'spam_mentions':
					// create the rule
					const amount = options.getInteger('amount');

					// check for rules with the trigger type 5
					const rules4 = await guild.autoModerationRules.fetch();
					const existingRule4 = rules4.find((rule) => rule.triggerType === 5);
					if (existingRule4) {
						await sendEmbed(interaction, 'This rule already exists');
						return;
					}

					const rule4 = await guild.autoModerationRules
						.create({
							name: `Spam Mentions Prevention | Prevented by @${client.user.username} Automoderation`,
							creatorId: '1149737617013870622',
							enabled: true,
							eventType: 1,
							triggerType: 5,
							triggerMetadata: {
								mentionTotalLimit: amount,
							},
							actions: [
								{
									type: 1,
									metadata: {
										channel: channel,
										durationSeconds: 10,
										customMessage:
											'This message was prevented by Ovx Automoderation',
									},
								},
							],
						})
						.catch(async (error) => {
							await sendErrorEmbed(interaction, error);
							await sendEmbed(interaction, `\`${error}\``);
						});

					if (!rule4) return;

					const Embed4 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Automod')
						.setDescription(
							`Successfully created a automod rule, this rule will prevent spam mentions that have \`${amount}\` tags from being used.\n\n**Rule Name:** \`${rule4.name}\`\n**Rule ID:** \`${rule4.id}\``
						)
						.setColor(EmbedColour)
						.setTimestamp()
						.setFooter({
							text: FooterText,
							iconURL: FooterImage,
						});

					await interaction.editReply({ embeds: [Embed4] });

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
