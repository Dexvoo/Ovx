const { SlashCommandBuilder, Colors, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, Events } = require('discord.js');
const path = require('node:path');
const fsPromises = require('node:fs').promises;
require('dotenv').config();

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('(Developer) Reloads a command')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload')
                .setAutocomplete(true)
                .setRequired(true)
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
    * @param {import('../../types').CommandInputUtils} interaction
    */

    async execute(interaction) {
        const { options, client, user, member } = interaction;

        if(!client.utils.DevCheck(user.id)) return client.utils.Embed(interaction, Colors.Red, 'Command Failed', `User Missing Permission: \`Developer\``);
        
        client.emit(Events.GuildMemberAdd, member);
        client.emit(Events.GuildMemberRemove, member);

        
        const commandName = options.getString('command').toLowerCase();
        const command = client.commands.get(commandName);

        if(!command) return client.utils.Embed(interaction, Colors.Red, `There is no command with the name \`${commandName}\``);


        const commandPath = path.join(__dirname, '..', '..', 'commands');
        const url = await crawlDirectory(commandPath, commandName);
        
        if(!url) return client.utils.Embed(interaction, Colors.Red, `Failed to find command file for \`${commandName}\``);

        delete require.cache[require.resolve(url)];

        try {
            const newCommand = require(url);
            client.commands.set(newCommand.data.name, newCommand);

            client.utils.Embed(interaction, Colors.Green, `Successfully reloaded \`${commandName}\``);
        } catch (error) {
            console.error(error);
            client.utils.Embed(interaction, Colors.Red, `Failed to reload \`${commandName}\``);
        }
        
    }
};


async function crawlDirectory(currentDirectory, targetCommandName) {
    const allDirectories = await fsPromises.readdir(currentDirectory, { withFileTypes: true });

    for (const directory of allDirectories) {
        const newPath = path.join(currentDirectory, directory.name);

        if (directory.isDirectory()) {
            const result = await crawlDirectory(newPath, targetCommandName);
            if (result) return result;
        }

        if (!directory.name.endsWith('.js')) continue;

        const command = require(newPath);
        if(!command) continue;

        if ('data' in command && 'execute' in command) {
            if (command.data.name === targetCommandName) {
                return newPath;
            }
        }
    }

    return false;
}