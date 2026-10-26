import {
    SlashCommandBuilder,
    MessageFlags,
    ApplicationIntegrationType,
    InteractionContextType,
    Events,
} from 'discord.js';

const supportedEvents = [
    Events.ClientReady,
    Events.InteractionCreate,
    Events.GuildCreate,
    Events.GuildDelete,
    Events.GuildUpdate,
    Events.GuildUnavailable,
    Events.GuildMemberAdd,
    Events.GuildMemberRemove,
    Events.GuildMemberUpdate,
    Events.ChannelCreate,
    Events.ChannelDelete,
    Events.ChannelUpdate,
    Events.WebhooksUpdate,
    Events.GuildRoleCreate,
    Events.GuildRoleDelete,
    Events.GuildRoleUpdate,
    Events.UserUpdate,
    Events.VoiceStateUpdate,
    Events.GuildBanAdd,
    Events.GuildBanRemove,
    Events.MessageCreate,
    Events.MessageDelete,
    Events.MessageUpdate,
];

export const commandData = new SlashCommandBuilder();
commandData.setName('simulate');
commandData.setDescription('Simulate Client Events');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addStringOption((o) =>
    o.setName('event').setDescription('The event you would like to simulate.').setAutocomplete(true).setRequired(true)
);

export const meta = {
    cooldown: 5,
    developerOnly: true,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param { import('discord.js').AutocompleteInteraction } interaction
 */
export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = supportedEvents;
    const filtered = choices.filter((c) => c.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);

    await interaction.respond(filtered.map((c) => ({ name: c, value: c })));
}

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction, client) {
    const { options } = interaction;
    const event = options.getString('event');

    const eventPayloads = {
        [Events.ClientReady]: [client],
        [Events.InteractionCreate]: [interaction],

        [Events.GuildCreate]: [interaction.guild],
        [Events.GuildDelete]: [interaction.guild],
        [Events.GuildUpdate]: [interaction.guild, interaction.guild], // [oldGuild, newGuild][Events.GuildUnavailable]: [interaction.guild],

        // Members
        [Events.GuildMemberAdd]: [interaction.member],
        [Events.GuildMemberRemove]: [interaction.member],
        [Events.GuildMemberUpdate]: [interaction.member, interaction.member], // [oldMember, newMember]

        // Channels
        [Events.ChannelCreate]: [interaction.channel],
        [Events.ChannelDelete]: [interaction.channel],
        [Events.ChannelUpdate]: [interaction.channel, interaction.channel], //[oldChannel, newChannel]
        [Events.WebhooksUpdate]: [interaction.channel],

        // Roles
        [Events.GuildRoleCreate]: [interaction.guild.roles.everyone],
        [Events.GuildRoleDelete]: [interaction.guild.roles.everyone],
        [Events.GuildRoleUpdate]: [interaction.guild.roles.everyone, interaction.guild.roles.everyone], //[oldRole, newRole]

        // Users
        [Events.UserUpdate]: [interaction.user, interaction.user], // [oldUser, newUser]

        // Voice
        [Events.VoiceStateUpdate]: [interaction.member.voice, interaction.member.voice], // [oldState, newState]

        // Bans
        [Events.GuildBanAdd]: [{ guild: interaction.guild, user: interaction.user, reason: 'Simulation Ban' }],
        [Events.GuildBanRemove]: [{ guild: interaction.guild, user: interaction.user, reason: 'Simulation Unban' }],

        // Messages
        [Events.MessageCreate]: [interaction.channel.messages.cache.last()],
        [Events.MessageDelete]: [interaction.channel.messages.cache.last()],
        [Events.MessageUpdate]: [interaction.channel.messages.cache.last(), interaction.channel.messages.cache.last()],
    };

    const payload = eventPayloads[event];
    if (!payload)
        return client.utils.Embed(
            interaction,
            'Red',
            'Error',
            `I don't know how to simulate the \`${event}\` event yet. Please configure its arguments in the command file!`,
            { flags: MessageFlags.Ephemeral }
        );

    try {
        if (Events.MessageDelete === event || Events.MessageCreate === event || Events.MessageUpdate === event) {
            if (!interaction.channel.messages.cache.last())
                return client.utils.Embed(interaction, 'Red', '⚠️ Error', `Make sure to send a message first!`, {
                    flags: MessageFlags.Ephemeral,
                });
        }
        client.emit(event, ...payload);

        client.utils.Embed(interaction, 'DarkPurple', 'Simulated', `Successfully simulated the \`${event}\` event!`, {
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        client.utils.LogData('Simulate', `Failed to simulate ${event}: ${error.stack ?? error.message}`, 'error');
        client.utils.Embed(
            interaction,
            'Red',
            'Error',
            `Failed to simulate \`${event}\` due to an error. Check console.`,
            { flags: MessageFlags.Ephemeral }
        );
    }
}
