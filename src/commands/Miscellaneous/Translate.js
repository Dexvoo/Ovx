const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const translate = require('@iamtraction/google-translate');
require('dotenv').config();

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text to another language.')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        
        .addStringOption((option) => option
            .setName('text')
            .setDescription('Text to translate.')
            .setRequired(true)
        )
        .addStringOption((option) => option
            .setName('language')
            .setDescription('Language to translate to.')
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

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, user } = interaction;
        
        await interaction.deferReply();

        const text = options.getString('text')
        const language = options.getString('language')
        const translation = await translate(text, { to: language })
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

        const languageFrom = LanguageList[translation.from.language.iso];
        const languageTo = LanguageList[language]

        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setFields(
                { name: `Original Text : ${languageFrom}`, value: `${text.substring(0, 1024) || 'No text provided.'}` },
                { name: `Translated Text : ${languageTo}`, value: `${translation.text.substring(0, 1024) || 'Unable to translate.'}`}
            )
            .setFooter({ text: `Translation requested by @${user.username}`});

        interaction.editReply( { embeds: [Embed] })
    }
};