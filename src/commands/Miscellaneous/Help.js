const { SlashCommandBuilder, EmbedBuilder, Colors, InteractionContextType, ApplicationIntegrationType, AutocompleteInteraction, ApplicationCommandOptionType, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Provides help on specific commands.')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        
        .addStringOption((option) => option
            .setName('command')
            .setDescription('Name of command')
            .setAutocomplete(true)
            .setRequired(false)
        ),

    
    /**
    * @param {AutocompleteInteraction} interaction
    */
    async autocomplete(interaction) {
        const { options, client } = interaction;
        const value = options.getFocused();
        const commands =  client.commands;

        const choices =  commands.map(command => command.data.name);
        const filteredChoices = choices.filter(choice => choice.toLowerCase().includes(value.toLowerCase())).sort().slice(0, 25);

        if(!interaction) return;

        await interaction.respond(filteredChoices.map(choice => ({ name: choice, value: choice })));
    },

    /**
     * @param {import('../../types').CommandInputUtils} interaction
     */

    async execute(interaction) {
        const { options, client } = interaction;
        await interaction.deferReply();
        
        const targetCommand =  options.getString('command');

        if(!targetCommand) {
            const commands = client.commands;
            const categories = [...new Set(commands.map(command => command.category).filter(category => category !== 'Developer'))];

            const fields = categories.map(category => {
                const commandList = commands.filter(command => command.category === category).map(command => `${command.commandTags.join('\n')}`).join('\n');
                return { name: category, value: commandList || 'No commands found', inline: false };
            });

            const helpEmbed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setTitle('Help')
                .setDescription('Welcome to the help menu, here you can find all the commands for the bot.\n\nTo get help with a specific command, use \`/help <command>\`')
                .addFields(fields);

            return await interaction.editReply({ embeds: [helpEmbed] });
        }

        const command = client.commands.get(targetCommand);

        if(!command) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`\`${targetCommand}\` does not exist!`);
            return await interaction.editReply({embeds: [Embed]});
        }

        const commandName = command.data.name ? command.data.name.charAt(0).toUpperCase() + command.data.name.slice(1) : 'No name found';
        let embedDescription = `-# ${command.data.description ? command.data.description : 'No description found'}`

        let OptionsCount = 0
        if(command.data.options?.length) {

            for(const option of command.data.options) {
                if(option instanceof SlashCommandSubcommandGroupBuilder) {
                    embedDescription += formatSubCommandGroup(option, command.commandTags);
                } else if(option instanceof SlashCommandSubcommandBuilder) {
                    embedDescription += formatSubCommand(option, command.commandTags);
                } else {
                    embedDescription += formatOptions(command, command.commandTags);
                    break;
                }
            }

        } else {
            embedDescription += formatOptions(command, command.commandTags);
        }

        client.utils.Embed(interaction, Colors.Blurple, `Command: ${commandName}`, embedDescription)
        
    }
};

function formatOptions(command, commandTags) {
    let desc = '';
    const tag = commandTags.find(cmd => cmd.includes(command.data.name)) || command.data.name;

    desc += `\n\n**${tag}** :`;

    for (const option of command.data.options) {
        desc += `\n\`{${option.name}} - ${option.description || 'No description'}\``;
    }

    return desc;
}

function formatSubCommandGroup(option, commandTags) {
    let desc = `\n## ${option.name} : *${option.description || 'No description'}*`;

    for (const sub of option.options ?? []) {
        desc += formatSubCommand(sub, commandTags);
    }

    return desc;
}

function formatSubCommand(option, commandTags) {
    const tag = commandTags.find(cmd => cmd.includes(option.name)) || option.name;
    let desc = `\n\n**${tag}** : *${option.description || 'No description'}*`;

    if (Array.isArray(option.options) && option.options?.length) {
        for (const subOption of option.options) {
            desc += `\n\`{${subOption.name}} - ${subOption.description || 'No description'}\``;
        }
    }

    return desc;
}