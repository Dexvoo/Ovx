const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType, AutocompleteInteraction, ApplicationCommandOptionType, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } = require('discord.js');
require('dotenv').config();
const { DeveloperMode, SupportServerUrl } = process.env;

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
        const filteredChoices = choices.filter(choice => choice.toLowerCase().includes(value.toLocaleLowerCase())).slice(0, 25);

        if(!interaction) return;

        await interaction.respond(filteredChoices.map(choice => ({ name: choice, value: choice })));
    },

    /**
     * @param {CommandInteraction} interaction
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
        const commandDescription = command.data.description ? command.data.description : 'No description found';
        const commandTest = command.commandTags ? command.commandTags.join('\n') : 'No command found';
        let embedDescription = `-# ${commandDescription}\n${commandTest}`
        var i = 0
        if(command.data.options) {
            for(const option of command.data.options) {
                if(option instanceof SlashCommandSubcommandGroupBuilder) {
                    embedDescription += `**${option.name}** (sub group)`

                    if(option.options) {
                        
                        for(const sub of option.options) {

                            embedDescription += `\n\n**${sub.name.charAt(0).toUpperCase() + sub.name.slice(1)}:**\n${command.commandTags[i]}\n`
                            if(sub.options) {
                                const arrayOptions = [];
                                for(const subsub of sub.options) {
                                    arrayOptions.push(`${subsub.name} : ${subsub.description}`)
                                }

                                embedDescription += `\`${arrayOptions.join('\n')}\``
                            }
                            i++;
                            
                        }
                    }
                    i = 0
                } else {
                    if(i === 0) embedDescription += `${command.commandTags[i]}\n\`${option.name} : ${option.description}\``
                    else embedDescription += `\n\`${option.name} : ${option.description}\``;
                    i++;
                }
            }
            i = 0;
        };

        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(`Command: ${commandName}`)
            .setDescription(embedDescription);

            await interaction.editReply({ embeds: [Embed]});
        
    }
};