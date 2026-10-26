import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import Guild_Level_Cache from '../cache/guildLevels.cache.js';
import { applyAdminChange, ADMIN_XP_MAX } from '../utils/admin.js';
import { createMongoAuditStore } from '../../../dashboard/auditStore.js';
import { LogData } from '../../../shared/utils/logger.js';

const userOption = (option) => option.setName('user').setDescription('Whose XP to change.').setRequired(true);
const syncOption = (option) =>
    option.setName('update_roles').setDescription('Give or take level reward roles to match (default: yes).');

export const commandData = new SlashCommandBuilder();
commandData.setName('leveladmin');
commandData.setDescription("Change a member's XP or level.");
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
// Only shown to members with Manage Server (server admins can change who sees it under Integrations)
commandData.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
commandData.addSubcommand((sub) =>
    sub
        .setName('give')
        .setDescription('Give a member XP.')
        .addUserOption(userOption)
        .addIntegerOption((option) =>
            option
                .setName('amount')
                .setDescription('How much XP.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(ADMIN_XP_MAX)
        )
        .addBooleanOption(syncOption)
);
commandData.addSubcommand((sub) =>
    sub
        .setName('take')
        .setDescription('Take XP from a member.')
        .addUserOption(userOption)
        .addIntegerOption((option) =>
            option
                .setName('amount')
                .setDescription('How much XP.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(ADMIN_XP_MAX)
        )
        .addBooleanOption(syncOption)
);
commandData.addSubcommand((sub) =>
    sub
        .setName('set-xp')
        .setDescription("Set a member's total XP. Their level follows.")
        .addUserOption(userOption)
        .addIntegerOption((option) =>
            option
                .setName('xp')
                .setDescription('Their new total XP.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(ADMIN_XP_MAX)
        )
        .addBooleanOption(syncOption)
);
commandData.addSubcommand((sub) =>
    sub
        .setName('set-level')
        .setDescription("Set a member's level. They start at the beginning of it.")
        .addUserOption(userOption)
        .addIntegerOption((option) =>
            option
                .setName('level')
                .setDescription('Their new level.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(1000)
        )
        .addBooleanOption(syncOption)
);
commandData.addSubcommand((sub) =>
    sub
        .setName('reset')
        .setDescription("Reset a member's XP and level to 0. Their message and voice stats are kept.")
        .addUserOption(userOption)
        .addBooleanOption(syncOption)
);

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    // Also hides the command from members without it
    userPermissions: [PermissionFlagsBits.ManageGuild],
};

const auditStore = createMongoAuditStore();

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, options, guild, locale } = interaction;
    const t = (key, vars) => client.utils.Translate(`commands.leveladmin.${key}`, locale, vars);
    const fail = (key, vars) =>
        client.utils.Embed(interaction, 'Red', client.utils.Translate('errors.title', locale), t(key, vars), {
            flags: MessageFlags.Ephemeral,
        });

    const operation = /** @type {import('../utils/admin.js').AdminOperation} */ (options.getSubcommand());
    const user = options.getUser('user', true);
    if (user.bot) return fail('bot', { user: `${user}` });

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return fail('not_member', { user: `${user}` });

    const amount = options.getInteger('amount') ?? options.getInteger('xp') ?? options.getInteger('level') ?? 0;
    const syncRoles = options.getBoolean('update_roles') ?? true;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildData = await Guild_Level_Cache.get(guild.id);
    const result = await applyAdminChange(member, guildData, operation, amount, { syncRoles });
    if (!result) return fail('load_failed');

    const { before, after, roles } = result;
    const fmt = (state) => t('state', { level: state.level, xp: state.xp.toLocaleString('en-GB') });
    const lines = [t('changed', { user: `${member}`, before: fmt(before), after: fmt(after) })];

    const maxLevel = guildData.maxLevel ?? 100;
    if ((operation === 'give' || operation === 'set-xp' || operation === 'set-level') && after.level >= maxLevel) {
        lines.push(t('at_max', { level: maxLevel }));
    }
    if (roles.added.length) lines.push(t('roles_added', { roles: roles.added.map((id) => `<@&${id}>`).join(', ') }));
    if (roles.removed.length)
        lines.push(t('roles_removed', { roles: roles.removed.map((id) => `<@&${id}>`).join(', ') }));
    if (roles.failed.length) lines.push(t('roles_failed', { roles: roles.failed.map((id) => `<@&${id}>`).join(', ') }));
    if (!guildData.enabled) lines.push('', t('levels_off'));

    // Recorded in the server's Web Logs, like changes made on the dashboard
    if (before.xp !== after.xp) {
        await auditStore
            .record({
                guildId: guild.id,
                user: {
                    id: interaction.user.id,
                    username: interaction.user.username,
                    displayName: interaction.user.displayName,
                    avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }),
                },
                action: "Changed a member's level",
                changes: [
                    `@${member.user.username}: level ${before.level} (${before.xp} XP) → level ${after.level} (${after.xp} XP)`,
                ],
                source: `/leveladmin ${operation}`,
            })
            .catch((error) => LogData('Level Admin', `Could not write Web Logs entry: ${error.message}`, 'warning'));
    }

    return client.utils.Embed(interaction, 'Brand', t('title'), lines.join('\n'), { flags: MessageFlags.Ephemeral });
}
