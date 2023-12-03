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
	FLIPCOIN: `Dealer is flipping the coin`,
	NO_MONEY: `Please use the </Balance:1152750531094270003> command to start your gambling adventure!`,
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
		.setName('coinflip')
		.setDescription('Play Coinflip.')
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('side')
				.setDescription('The side to bet on.')
				.setRequired(true)
				.addChoices(
					{
						name: HEADS,
						value: HEADS,
					},
					{
						name: TAILS,
						value: TAILS,
					}
				)
		)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('The amount of coins to bet.')
				.setRequired(true)
		),

	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			const { options, user, client } = interaction;

			// Placeholder Embed
			await sendEmbed(interaction, messages.FLIPCOIN);
			await sleep(2000);

			// Guild Check
			if (!guildCheck(interaction)) return;

			// Variables
			const side = options.getString('side');
			const amount = options.getInteger('amount');

			// Check if the user has enough coins
			const userCurrency = await UserCurrency.findOne({
				userid: user.id,
			});

			// User has not played before
			if (!userCurrency) {
				return await sendEmbed(interaction, messages.NO_MONEY);
			}

			// Check if the user has enough coins
			if (userCurrency.currency < amount) {
				return sendEmbed(interaction, messages.NOT_ENOUGH_MONEY);
			}

			// Check if the user has bet a valid amount
			if (amount < MIN_BET_AMOUNT || amount > MAX_BET_AMOUNT) {
				return sendEmbed(interaction, messages.INVALID_BET_AMOUNT);
			}

			const randomCoinToss = Math.floor(Math.random() * 2);
			const result = randomCoinToss === 0 ? HEADS : TAILS;
			const win = result === side;

			// Update the user's coins
			userCurrency.currency = win
				? userCurrency.currency + amount
				: userCurrency.currency - amount;

			await userCurrency.save();

			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle('Coinflip')
				.setDescription(
					[
						`Bet Amount : \`${amount}\``,
						`Side Bet : \`${side}\`\n`,
						`Result : \`${result}\``,
						`${win ? messages.WIN : messages.LOSE}`,
						`New Balance : \`${userCurrency.currency.toLocaleString()}\``,
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
