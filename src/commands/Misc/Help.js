const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, AutocompleteInteraction, InteractionContextType } = require('discord.js');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List all of my commands or info about a specific command')
        .setContexts( InteractionContextType.BotDM, InteractionContextType.Guild )
        .addStringOption(option => option
            .setName('command')
            .setDescription('Name of the command')
            .setAutocomplete(true)
            .setRequired(false)
        ),

    /**
     * @param {AutocompleteInteraction} interaction
     */
    async autocomplete(interaction) {
        const { options, client } = interaction;
        const value = options.getFocused()
        const commands = client.commands;

        const choices = commands.filter(command => command.category !== 'Developer').map(command => command.data.name);
        const filteredChoices = choices.filter(choice => choice.toLowerCase().includes(value)).slice(0, 25);

        if(!interaction) return;

        await interaction.respond(filteredChoices.map((choice) => ({ name: choice, value: choice })));
    },

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;

        const targetCommand = options.getString('command');

        if(!targetCommand) {
            const commands = client.commands;
            const categories = [...new Set(commands.map(command => command.category))];

            const fields = categories.map(category => {
                const commandList = commands
                    .filter(command => command.category === category && command.data.name !== 'Developer')
                    .map(command => `${command.commandTags.join('\n')}`)
                    .join('\n');
            
                return {
                    name: category,
                    value: commandList || 'No commands found',
                    inline: false,
                };
            });

            const helpEmbed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setTitle('Help')
                .setDescription('Welcome to the help menu, here you can find all the commands for the bot.\n\nTo get help with a specific command, use \`/help <command>\`')
                .addFields(fields);

            return await interaction.reply({ embeds: [helpEmbed] });

        }

        const command = client.commands.get(targetCommand);

        if(!command) {
            const invalidEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('That command does not exist');
            return await interaction.reply({ embeds: [invalidEmbed], ephemeral: true });
        }

        const commandName = command.data.name ? command.data.name.charAt(0).toUpperCase() + command.data.name.slice(1) : 'No name found';

        const commandDescription = command.data.description ? command.data.description : 'No description found';
        const commandTest = command.commandTags ? command.commandTags.join('\n') : 'No command found';
        let embedDescription = commandDescription

        if(command.data.options && command.data.options.length > 0) {
            const optionsDetails = command.data.options.map(option => {
            const optionName = option.name ? option.name.charAt(0).toUpperCase() + option.name.slice(1) : 'No name found';
            const optionDescription = option.description ? option.description.charAt(0).toUpperCase() + option.description.slice(1) : 'No description found';
            const optionNames = option.options ? option.options.map(opt => `{${opt.name}}`).join(', ') : `{${option.name}}`;

            return `**Name:** ${optionName}\n**Description:** ${optionDescription}\n**Options:** ${optionNames}\n\n`;
            }).join('');

            embedDescription += `\n### Commands\n${commandTest}\n\n**Options:**\n${optionsDetails}`;
        }
        
        const helpEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(`Help: ${commandName}`)
            .setDescription(embedDescription);

        return await interaction.reply({ embeds: [helpEmbed] });
        
    }

};