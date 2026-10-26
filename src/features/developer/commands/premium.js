import { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import Guild_Settings_Cache, { PREMIUM_FOREVER } from '../../../shared/cache/guildSettings.cache.js';

const SNOWFLAKE = /^\d{17,20}$/;

export const commandData = new SlashCommandBuilder();
commandData.setName('premium');
commandData.setDescription('(Developer) Give or take away server premium.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addSubcommand((s) =>
    s
        .setName('grant')
        .setDescription('Give a server premium.')
        .addStringOption((o) => o.setName('server-id').setDescription('The server ID').setRequired(true))
        .addIntegerOption((o) =>
            o.setName('days').setDescription('How long (leave out for no end date)').setMinValue(1).setMaxValue(3650)
        )
);
commandData.addSubcommand((s) =>
    s
        .setName('revoke')
        .setDescription('Take premium away from a server.')
        .addStringOption((o) => o.setName('server-id').setDescription('The server ID').setRequired(true))
);
commandData.addSubcommand((s) =>
    s
        .setName('check')
        .setDescription('See whether a server has premium.')
        .addStringOption((o) => o.setName('server-id').setDescription('The server ID').setRequired(true))
);

export const meta = {
    cooldown: 3,
    developerOnly: true,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, options } = interaction;
    const subcommand = options.getSubcommand();
    const guildId = options.getString('server-id', true).trim();
    const reply = (colour, title, text) =>
        client.utils.Embed(interaction, colour, title, text, { flags: MessageFlags.Ephemeral });

    if (!SNOWFLAKE.test(guildId)) return reply('Red', 'Premium', 'That is not a server ID.');

    if (subcommand === 'check') {
        const { premiumUntil } = await Guild_Settings_Cache.get(guildId);
        const active = premiumUntil && new Date(premiumUntil).getTime() > Date.now();
        return reply(
            'Brand',
            'Premium',
            active ? `\`${guildId}\` has premium ${until(premiumUntil)}.` : `\`${guildId}\` does not have premium.`
        );
    }

    const days = options.getInteger('days');
    const premiumUntil =
        subcommand === 'grant' ? (days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : PREMIUM_FOREVER) : null;
    await Guild_Settings_Cache.set(guildId, { premiumUntil });

    // Each shard caches settings, so all of them forget this server's copy
    if (client.shard) {
        await client.shard.broadcastEval((shardClient, { id }) => shardClient.invalidateGuildSettings(id), {
            context: { id: guildId },
        });
    } else {
        await client.invalidateGuildSettings(guildId);
    }

    client.utils.LogData('Premium', `${subcommand} for ${guildId} by ${interaction.user.id}`, 'info');
    return reply(
        'Green',
        'Premium',
        premiumUntil
            ? `\`${guildId}\` now has premium ${until(premiumUntil)}.`
            : `Premium was taken away from \`${guildId}\`.`
    );
}

/** @param {Date} date */
function until(date) {
    return new Date(date).getTime() >= PREMIUM_FOREVER.getTime()
        ? 'with no end date'
        : `until <t:${Math.floor(new Date(date).getTime() / 1000)}:F>`;
}
