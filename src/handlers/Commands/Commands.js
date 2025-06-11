const { Colors, EmbedBuilder, ChatInputCommandInteraction, Collection } = require('discord.js');
const { SendEmbed, ShortTimestamp } = require('../../utils/LoggingData');
const { permissionCheck } = require('../../utils/Permissions');
require('dotenv').config()

const { DeveloperIDs } = process.env;

/**
 * @param {ChatInputCommandInteraction} interaction
 */
module.exports = async function CommandExecute(interaction) {
    const { guild, commandName, client, user, member } = interaction;
    
    const command = client.commands.get(commandName);
    if(!command) return;

    await commandCooldown(interaction, command);

    
    await permissions(interaction, command);


    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        if(interaction.replied || interaction.deferred) {
            const Embed = new EmbedBuilder()
				.setColor('Red')
				.setDescription('There was an error while executing this command!')
			await interaction.followUp({ embeds: [Embed] });
        } else {
            SendEmbed(interaction, Colors.Red, 'Command Failure', 'There was an error while executing this command!');
        };
    };


};

/**
 * @param {ChatInputCommandInteraction} interaction
 */
async function commandCooldown(interaction, command) {
    const { client, commandName, user } = interaction;
    const { cooldowns } = client;
    if(!cooldowns.has(commandName)) cooldowns.set(commandName, new Collection());

    const now = Date.now();
    const timestamps = cooldowns.get(commandName);
    const cooldownAmount = (command.cooldown || 5) * 1000;

    if(timestamps.has(user.id)) {
        const expirationTime = timestamps.get(user.id) + cooldownAmount;
        if(now < expirationTime) return SendEmbed(interaction, Colors.Red, 'Command Cooldown', 'You are on cooldown!', 
            [
                { name: 'Command', value: `\`/${command.data.name}\``,inline: true}, 
                { name: 'Cooldown Ends', value: ShortTimestamp(expirationTime), inline: true }
            ]);
    };

    // if(!DeveloperIDs.includes(user.id)) timestamps.set(user.id, now) && setTimeout(() => timestamps.delete(user.id), cooldownAmount);
    timestamps.set(user.id, now) && setTimeout(() => timestamps.delete(user.id), cooldownAmount);
};


/**
 * @param {ChatInputCommandInteraction} interaction
 */
async function permissions(interaction, command) {
    const { guild, member, client } = interaction;
    if(guild) {
        if(command.botpermissions) {
            const [hasPermissions, missingPermissions] = permissionCheck(interaction, command.botpermissions, client);
            if(!hasPermissions) return SendEmbed(interaction, Colors.Red, 'Missing Permissions', `Bot Missing Permissions: \`${missingPermissions}\``);
        };

        if(command.userpermissions) {
            const [hasPermissions, missingPermissions] = permissionCheck(interaction, command.userpermissions, member);
            if(!hasPermissions) return SendEmbed(interaction, Colors.Red, 'Missing Permissions', `User Missing Permissions: \`${missingPermissions}\``);
        };
    };
};