const { SlashCommandBuilder, Colors, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('(Developer) Reloads a command.')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload.')
                .setAutocomplete(true)
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        const { client } = interaction;
        const focusedValue = interaction.options.getFocused();
        const choices = client.commands.map(command => command.data.name);
        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase())).slice(0, 25);
        
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        const { options, client, user } = interaction;

        if (!client.utils.DevCheck(user.id)) {
            return client.utils.Embed(interaction, Colors.Red, 'Command Failed', 'User Missing Permission: `Developer`');
        }

        const commandName = options.getString('command');
        const command = client.commands.get(commandName);

        if (!command) {
            return client.utils.Embed(interaction, Colors.Red, 'Error', `There is no command with the name \`${commandName}\`.`);
        }

        const commandPath = findCommandPath(command.category, commandName);

        if (!commandPath) {
            return client.utils.Embed(interaction, Colors.Red, 'Error', `Could not find the file for command \`${commandName}\`.`);
        }

        delete require.cache[require.resolve(commandPath)];

        try {
            const newCommand = require(commandPath);
            client.commands.set(newCommand.data.name, newCommand);
            client.utils.Embed(interaction, Colors.Green, 'Success', `Successfully reloaded command \`${newCommand.data.name}\`.`);
        } catch (error) {
            console.error(`Error reloading command ${commandName}:`, error);
            client.utils.Embed(interaction, Colors.Red, 'Error', `There was an error while reloading command \`${commandName}\`:\n\`${error.message}\``);
        }
    }
};

function findCommandPath(category, commandName) {
    const categoryPath = path.join(__dirname, '..', '..', 'commands', category);
    try {
        const files = fs.readdirSync(categoryPath);
        const commandFile = files.find(file => file.toLowerCase().startsWith(commandName.toLowerCase()) && file.endsWith('.js'));
        if (commandFile) {
            return path.join(categoryPath, commandFile);
        }
    } catch (error) {
        // This can happen if the category directory doesn't exist, which is fine.
        return null;
    }
    return null;
}