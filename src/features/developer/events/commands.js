import { EmbedBuilder, Events, Colors, ApplicationCommandOptionType } from 'discord.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Developer Command Logs';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').Interaction} interaction
 */

export async function execute(interaction) {
    const { client, guild, user, channel } = interaction;

    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

    try {
        const commandText = buildCommandText(interaction);
        const LogEmbed = new EmbedBuilder()
            .setTitle(`Command Executed | Shard #${client.shard?.ids[0] ?? 0}`)
            .setColor(Colors.DarkPurple)
            .addFields(
                { name: 'User', value: `@${user.username} (${user})`, inline: true },
                ...(guild
                    ? [
                          { name: 'Guild', value: `${guild.name} (${guild.id})`, inline: true },
                          { name: 'Channel', value: `${channel}`, inline: true },
                      ]
                    : []),
                {
                    name: 'Command',
                    value: `\`${commandText.substring(0, 1020)}\``,
                    inline: false,
                }
            )
            .setTimestamp();

        await client.utils.DevEmbed('command', client, LogEmbed);
    } catch (error) {
        client.utils.LogData('Command Log', `Failed to send command log: ${error.message}`, 'error');
    }
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').ContextMenuCommandInteraction} interaction
 */

function buildCommandText(interaction) {
    const parts = [`/${interaction.commandName}`];
    // Options a command marks as private (e.g. the text given to /translate) are never logged
    /** @type {string[]} */
    const privateOptions = interaction.client.commands.get(interaction.commandName)?.meta.privateOptions ?? [];

    /** @param {readonly import('discord.js').CommandInteractionOption[]} [options] */
    const processOptions = (options = []) => {
        for (const opt of options) {
            if (
                opt.type === ApplicationCommandOptionType.SubcommandGroup ||
                opt.type === ApplicationCommandOptionType.Subcommand
            ) {
                parts.push(opt.name);
                processOptions(opt.options);
            } else {
                parts.push(`${opt.name}:${privateOptions.includes(opt.name) ? '[hidden]' : opt.value}`);
            }
        }
    };

    processOptions(interaction.options?.data);
    return parts.join(' ');
}
