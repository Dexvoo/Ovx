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
        const commandTags = command.commandTags ? command.commandTags.join('\n') : 'No command found';
        let embedDescription = `-# ${commandDescription}`
        // console.log(command)

        let OptionsCount = 0
        if(command.data.options.length > 0) {

            for(const option of command.data.options) {
                // console.log(option)
                if(option instanceof SlashCommandSubcommandGroupBuilder) {
                    console.log('Sub Group Options')
                    // console.log(option)
                    embedDescription = `${embedDescription}\n# ${option.name} : *${option.description}*` // Sub group name

                    if(option.options.length > 0){
                        for(const options2 of option.options) {
                            // console.log(options2)
                            const commandTag = command.commandTags.find(cmd => cmd.includes(options2.name))
                            embedDescription = `${embedDescription}\n\n${commandTag} : *${options2.description}*` // command names

                            if(options2.options.length > 0) {
                                for(const options3 of options2.options) {
                                    console.log(options3)
                                    embedDescription = `${embedDescription}\n\`{${options3.name}} - ${options3.description}\``
                                }
                            }
                        }
                    }

                } else if(option instanceof SlashCommandSubcommandBuilder) {
                    console.log('Sub Options')
                    const commandTag = command.commandTags.find(cmd => cmd.includes(option.name))
                    embedDescription = `${embedDescription}\n\n**${commandTag}** : *${option.description}*`
                    if(option.options.length > 0) {
                        // console.log(option.options)
                        for(const option2 of option.options) {
                            embedDescription = `${embedDescription}\n\`{${option2.name}} - ${option2.description}\``
                        }
                    }
                } else {
                    console.log('Some Options')
                    if(OptionsCount > 0) {
                        embedDescription = `${embedDescription}\n\`{${option.name}} - ${option.description}\``
                    } else {
                        const commandTag = command.commandTags.find(cmd => cmd.includes(command.data.name))
                        embedDescription = `${embedDescription}\n${commandTag} : \n\`{${option.name}} - ${option.description}\``
                        OptionsCount++
                    }
                }
            }

        } else {
            console.log('No Options')
            const commandTag = command.commandTags.find(cmd => cmd.includes(command.data.name))
            embedDescription = `${embedDescription}\n${commandTag}`
        }

        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(`Command: ${commandName}`)
            .setDescription(embedDescription);

            await interaction.editReply({ embeds: [Embed]});
        
    }
};