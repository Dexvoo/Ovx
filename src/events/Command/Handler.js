const { Events, EmbedBuilder, CommandInteraction, Collection, MessageFlags } = require('discord.js')
const { permissionCheck } = require('../../utils/Permissions.js')
const { ShortTimestamp } = require('../../utils/LoggingData.js')
require('dotenv').config()

const { DeveloperIDs } = process.env;

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	nickname: 'Executing Commands',

	/**
	 * @param {CommandInteraction} interaction
	 */

	async execute(interaction) {
		
		const { guild, commandName, client, user, member } = interaction;
		if(!interaction.isCommand()) return;

		const command = client.commands.get(commandName);
		if (!command) return;

		const { cooldowns } = client		
		if (!cooldowns.has(command.data.name)) cooldowns.set(command.data.name, new Collection());
		
		const now = Date.now();
		const timestamps = cooldowns.get(command.data.name);
		const cooldownAmount = (command.cooldown || 5) * 1000;

		if(timestamps.has(user.id)) {
			const expirationTime = timestamps.get(user.id) + cooldownAmount;

			if (now < expirationTime) {
				const CooldownEmbed = new EmbedBuilder()
					.setTitle('Command Cooldown')
					.setDescription('You are on cooldown!')
					.addFields(
						{ name: 'Command', value: `\`/${command.data.name}\``,inline: true},
						{ name: 'Cooldown Ends', value: ShortTimestamp(expirationTime), inline: true }
					);
				return await interaction.reply({ embeds: [CooldownEmbed], flags: [MessageFlags.Ephemeral] });
			}
		}

		if(!DeveloperIDs.includes(user.id)) timestamps.set(user.id, now) && setTimeout(() => timestamps.delete(user.id), cooldownAmount);
		timestamps.set(user.id, now) && setTimeout(() => timestamps.delete(user.id), cooldownAmount);

		if(guild) {

			if(command.botpermissions) {
				const [hasPermissions, missingPermissions] = permissionCheck(interaction, command.botpermissions, client);

				if (!hasPermissions) {
					const Embed = new EmbedBuilder()
						.setColor('Red')
						.setDescription(`Bot Missing Permissions: \`${missingPermissions}\``);
					return await interaction.reply({ embeds: [Embed], flags: [MessageFlags.Ephemeral] });
				}
			}

			if(command.userpermissions) {
				const [hasPermissions, missingPermissions] = permissionCheck(interaction, command.userpermissions, member);

				if (!hasPermissions) {
					const Embed = new EmbedBuilder()
						.setColor('Red')
						.setDescription(`User Missing Permissions: \`${missingPermissions}\``);
					return await interaction.reply({ embeds: [Embed], flags: [MessageFlags.Ephemeral] });
				}
			}
		}

		try {
			await command.execute(interaction);
	
		} catch (error) {
			console.error(error);
	
			if (interaction.replied || interaction.deferred) {
				const Embed = new EmbedBuilder()
					.setColor('Red')
					.setDescription('There was an error while executing this command!')
				await interaction.followUp({ embeds: [Embed] })
	
			} else {
				const Embed = new EmbedBuilder()
					.setColor('Red')
					.setDescription('There was an error while executing this command!')
				await interaction.reply({ embeds: [Embed] })
			}
		}
	},
}