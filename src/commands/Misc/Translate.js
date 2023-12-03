const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { FooterText, FooterImage, EmbedColour } = process.env;
const translate = require('@iamtraction/google-translate');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { sleep } = require('../../utils/ConsoleLogs.js');

module.exports = {
	cooldown: 5,
	catagory: 'Miscellaneous',
	data: new SlashCommandBuilder()
		.setName('translate')
		.setDescription('Translate text to another language.')
		.addStringOption((option) =>
			option
				.setName('text')
				.setDescription('Text to translate')
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName('language')
				.setDescription('Language to translate to')
				.addChoices(
					{
						name: 'English',
						value: 'en',
					},
					{
						name: 'Spanish',
						value: 'es',
					},
					{
						name: 'French',
						value: 'fr',
					},
					{
						name: 'German',
						value: 'de',
					},
					{
						name: 'Italian',
						value: 'it',
					},
					{
						name: 'Japanese',
						value: 'ja',
					},
					{
						name: 'Korean',
						value: 'ko',
					},
					{
						name: 'Portuguese',
						value: 'pt',
					},
					{
						name: 'Russian',
						value: 'ru',
					},
					{
						name: 'Arabic',
						value: 'ar',
					}
				)
				.setRequired(true)
		),
	async execute(interaction) {
		const { member, options, user, client } = interaction;

		// Placeholder Embed
		await sendEmbed(interaction, `Translating Text`);
		await sleep(2000);

		// Variables
		const text = options.getString('text');
		const language = options.getString('language');
		const translation = await translate(text, { to: language });
		const LanguageList = {
			en: 'English',
			es: 'Spanish',
			fr: 'French',
			de: 'German',
			it: 'Italian',
			ja: 'Japanese',
			ko: 'Korean',
			pt: 'Portuguese',
			ru: 'Russian',
			ar: 'Arabic',
		};
		var LanguageFrom = LanguageList[translation.from.language.iso];
		var Languageto = LanguageList[language];

		const TranslationEmbed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setTitle('Translate')
			.addFields(
				{
					name: 'Author',
					value: `@${user.username} (${user})`,
				},
				{
					name: `Original Text : ${LanguageFrom}`,
					value: text,
				},
				{
					name: `Translated Text : ${Languageto}`,
					value: translation.text,
				}
			)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });

		interaction.editReply({ embeds: [TranslationEmbed] });
	},
};
