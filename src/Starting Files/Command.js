const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits } = require('discord.js');
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
        
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload')
                .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options } = interaction;

        const commandName = options.getString('command').toLowerCase();
        const command = interaction.client.commands.get(commandName);

        if(!command) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`There is no command with the name \`${commandName}\``);
            return interaction.reply({ embeds: [Embed] });
        }

        if(!DeveloperIDs.includes(interaction.user.id)) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('You do not have permission to use this command');
            return interaction.reply({ embeds: [Embed] });
        }

        const Url = await crawlDirectory('../', 'commands', commandName);

        delete require.cache[require.resolve(`../${command.category}/${commandName}.js`)];
        
    }
};


async function crawlDirectory(currentDirectory, type, targetCommandName) {
	const allDirectories = await fsPromises.readdir(currentDirectory, { withFileTypes: true });

	for(const directory of allDirectories) {
		const newPath = path.join(currentDirectory, directory.name);

		if(directory.isDirectory()) await crawlDirectory(newPath, type);
		
		if(!directory.name.endsWith('.js')) continue;

		

	}
};