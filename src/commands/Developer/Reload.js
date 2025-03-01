const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction } = require('discord.js');
const path = require('node:path');
const fsPromises = require('node:fs').promises;
require('dotenv').config();
const { DeveloperIDs } = process.env;

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
    * @param {CommandInteraction} interaction
    */

    async execute(interaction) {
        const { options } = interaction;

        if(!DeveloperIDs.includes(interaction.user.id)) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('You do not have permission to use this command');
            return interaction.reply({ embeds: [Embed] });
        }
        
        const commandName = options.getString('command').toLowerCase();
        const command = interaction.client.commands.get(commandName);

        if(!command) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`There is no command with the name \`${commandName}\``);
            return interaction.reply({ embeds: [Embed] });
        }


        const commandPath = path.join(__dirname, '..', '..', 'commands');
        const url = await crawlDirectory(commandPath, commandName);
        
        if(!url) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`Failed to find command file for \`${commandName}\``);
            return interaction.reply({ embeds: [Embed] });
        }

        delete require.cache[require.resolve(url)];

        try {
            const newCommand = require(url);
            interaction.client.commands.set(newCommand.data.name, newCommand);
            const Embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setDescription(`Successfully reloaded \`${commandName}\``);
            return interaction.reply({ embeds: [Embed] });
        } catch (error) {
            console.log(error);
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`Failed to reload \`${commandName}\``);
            return interaction.reply({ embeds: [Embed] });
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