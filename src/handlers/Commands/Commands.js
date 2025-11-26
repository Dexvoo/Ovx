const { Colors, EmbedBuilder, ChatInputCommandInteraction, Collection } = require('discord.js');
require('dotenv').config();
const { CooldownManager, CooldownType } = require('../../utils/Classes/cooldowns');
const cooldowns = new CooldownManager();

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function CommandExecute(interaction) {
  const { guild, commandName, client, user, member } = interaction;

  const command = client.commands.get(commandName);
  if (!command) return;

  if (!commandCooldown(interaction, command)) return console.log('oncooldown');

  await permissions(interaction, command);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      const Embed = new EmbedBuilder()
        .setColor('Red')
        .setDescription('There was an error while executing this command!');
      await interaction.followUp({ embeds: [Embed] });
    } else {
      client.utils.Embed(
        interaction,
        Colors.Red,
        'Command Failure',
        'There was an error while executing this command!'
      );
    }
  }
};

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
function commandCooldown(interaction, command) {
  const { client, commandName, user } = interaction;
  if (cooldowns.has('Command', user.id, commandName)) {
    const timeLeft = cooldowns.getRemaining('Command', user.id, commandName);
    client.utils.Embed(
      interaction,
      Colors.Red,
      'Command Cooldown',
      `\`/${command.data.name}\` ${client.utils.Timestamp(timeLeft)}`
    );
    return false;
  }

  const cooldownAmount = command.cooldown || 5;
  cooldowns.add('Command', user.id, cooldownAmount, commandName);
  return true;
}

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
async function permissions(interaction, command) {
  const { guild, member, client } = interaction;
  if (guild) {
    if (command.botpermissions) {
      const [hasPermissions, missingPermissions] = client.utils.PermCheck(
        interaction,
        command.botpermissions,
        client
      );
      if (!hasPermissions)
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Missing Permissions',
          `Bot Missing Permissions: \`${missingPermissions}\``
        );
    }

    if (command.userpermissions) {
      const [hasPermissions, missingPermissions] = client.utils.PermCheck(
        interaction,
        command.userpermissions,
        member
      );
      if (!hasPermissions)
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Missing Permissions',
          `User Missing Permissions: \`${missingPermissions}\``
        );
    }
  }
}
