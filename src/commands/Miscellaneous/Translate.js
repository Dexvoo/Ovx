const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const translate = require('@iamtraction/google-translate');

module.exports = {
	cooldown: 5,
	category: 'Miscellaneous',
	data: new SlashCommandBuilder()
		.setName('translate')
		.setDescription('Translate text to another language.')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
		.addStringOption((option) => option
			.setName('text')
			.setDescription('Text to translate')
			.setRequired(true)
		)
		.addStringOption((option) => option
			.setName('language')
			.setDescription('Language to translate to')
			.addChoices(
                    { name: 'English', value: 'en' },
                    { name: 'Spanish', value: 'es' },
                    { name: 'French', value: 'fr' },
                    { name: 'German', value: 'de' },
                    { name: 'Italian', value: 'it' },
                    { name: 'Japanese', value: 'ja' },
                    { name: 'Korean', value: 'ko' },
                    { name: 'Portuguese', value: 'pt' },
                    { name: 'Russian', value: 'ru' },
                    { name: 'Arabic', value: 'ar' },
                    { name: 'Latvian', value: 'lv' },
                    { name: 'Chinese (Simplified)', value: 'zh-cn' },
                    { name: 'Chinese (Traditional)', value: 'zh-tw' },
				)
				.setRequired(true)
		),
	async execute(interaction) {
		const { options, user } = interaction;
        await interaction.deferReply();

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
			lv: 'Latvian',
			'zh-cn': 'Chinese (Simplified)',
			'zh-tw': 'Chinese (Traditional)',
		};
		var LanguageFrom = LanguageList[translation.from.language.iso];
		var Languageto = LanguageList[language];

		const TranslationEmbed = new EmbedBuilder()
			.setColor('Blurple')
			.setTitle(`Translation requested by @${user.username}`)
			.addFields(
				{
					name: `Original Text : ${LanguageFrom}`,
					value: text.substring(0, 1024),
				},
				{
					name: `Translated Text : ${Languageto}`,
					value: translation.text.substring(0, 1024),
				}
			);

		interaction.editReply({ embeds: [TranslationEmbed] });
	},
};
