const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const UserCurrency = require('../../models/UserCurrency.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
require('dotenv').config();

const MIN_BET_AMOUNT = 1;
const MAX_BET_AMOUNT = 100000;
const HEADS = 'Heads';
const TAILS = 'Tails';

// Messages in a array to be used later
const messages = {
	SEND_DEFAULT_MESSAGE: `Getting your balance`,
	NOT_ENOUGH_MONEY: `You do not have enough coins to bet that amount`,
	INVALID_BET_AMOUNT: `You must bet between ${MIN_BET_AMOUNT} and ${MAX_BET_AMOUNT} coins`,
	INVALID_SIDE: `You must bet on either ${HEADS} or ${TAILS}`,
	WIN: `You won! ${SuccessEmoji}`,
	LOSE: `You lost! ${ErrorEmoji}`,
};

module.exports = {
	cooldown: 5,
	catagory: 'Games',
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Check your balance')
		.setDMPermission(false),

	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			const { options, user, client } = interaction;

			// Placeholder Embed
			await sendEmbed(interaction, messages.SEND_DEFAULT_MESSAGE);
			await sleep(2000);

			// Guild Check
			if (!guildCheck(interaction)) return;

			// Variables
			const side = options.getString('side');
			const amount = options.getInteger('amount');

			// Check if the user has enough coins
			var userCurrency = await UserCurrency.findOne({
				userid: user.id,
			});

			// User has not played before
			if (!userCurrency) {
				// make a new entry
				userCurrency = new UserCurrency({
					userid: user.id,
				});
				await userCurrency.save();
			}

			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle('Balance')
				.setDescription(
					[
						`**@${user.username}**`,
						`Balance : \`${userCurrency.currency.toLocaleString()}\``,
					].join('\n')
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error(error);

			return sendEmbed(
				interaction,
				`There was an error running this command\n\n${error}`
			);
		}
	},
};
