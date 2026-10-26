import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
    StringSelectMenuBuilder,
} from 'discord.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { inviteUrl, SUPPORT_URL } from '../../../shared/utils/invite.js';
import { voteUrl } from '../../votes/utils/votes.js';
import { ENV } from '../../../bootstrap/environment.js';

/** The category menu: `help:category`. The chosen value is the category ID, or "overview". */
export const HELP_MENU_ID = 'help:category';

/**
 * Categories in the order they're shown. Commands are sorted into them by their feature folder,
 * so a new command appears in /help without changing this file (unless it's a new feature).
 */
export const CATEGORIES = Object.freeze([
    { id: 'moderation', emoji: '🛡️', features: ['moderation'] },
    { id: 'levels', emoji: '📈', features: ['levels'] },
    { id: 'tickets', emoji: '🎫', features: ['tickets'] },
    { id: 'giveaways', emoji: '🎉', features: ['giveaways'] },
    { id: 'suggestions', emoji: '💡', features: ['suggestions'] },
    { id: 'expressions', emoji: '😀', features: ['expressions'] },
    { id: 'translate', emoji: '🌐', features: ['translate'] },
    { id: 'utility', emoji: '🧰', features: ['utility', 'information', 'votes'] },
]);

/** Set up on the dashboard only, so they have no commands to list. */
const DASHBOARD_FEATURES = [
    'logging',
    'welcome',
    'auto_roles',
    'reaction_roles',
    'automod',
    'verification',
    'invite_blocker',
    'honeypot',
    'starboard',
    'custom_embeds',
    'join_to_create',
    'server_stats',
    'auto_messages',
    'streams',
];

/**
 * @typedef {import('../../../core/baseCommands.js').Command} Command
 * @typedef {{ locale: string, guildId: string | null, context: number | null, ids: Map<string, string>,
 *   disabled?: Set<string> }} HelpContext - disabled: commands the server turned off (hidden)
 */

/**
 * Which feature a command belongs to, from its file's folder (src/features/<feature>/commands/...).
 * @param {Command} command
 */
export function featureOf(command) {
    return /\/features\/([^/]+)\/commands\//.exec(command.filePath.replaceAll('\\', '/'))?.[1] ?? null;
}

/**
 * The commands for a category that can be used where /help was used (e.g. not server-only ones in DMs).
 * @param {Iterable<Command>} commands
 * @param {string} categoryId
 * @param {number | null} context - The interaction's context (InteractionContextType)
 */
export function categoryCommands(commands, categoryId, context, disabled = new Set()) {
    const category = CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return [];
    return [...commands]
        .filter(
            (command) =>
                !command.meta.developerOnly &&
                !disabled.has(command.commandData.name) &&
                category.features.includes(featureOf(command))
        )
        .filter((command) => {
            const contexts = command.commandData.toJSON().contexts;
            return context === null || !contexts || contexts.includes(context);
        })
        .sort((a, b) => a.commandData.name.localeCompare(b.commandData.name));
}

/** Command name → ID, so commands show as clickable mentions. Cached per shard for an hour. */
let idCache = { at: 0, guildId: null, ids: new Map() };

/**
 * @param {import('discord.js').Client} client
 * @returns {Promise<Map<string, string>>}
 */
export async function commandIds(client) {
    const guildId = ENV.DEVELOPER_MODE ? ENV.DEV_GUILD_ID : null;
    if (Date.now() - idCache.at < 60 * 60 * 1000 && idCache.guildId === guildId) return idCache.ids;
    try {
        // Developer mode registers commands to the dev server instead of globally
        const fetched = guildId
            ? await client.application.commands.fetch({ guildId })
            : await client.application.commands.fetch();
        idCache = { at: Date.now(), guildId, ids: new Map(fetched.map((command) => [command.name, command.id])) };
    } catch {
        // Shown as plain text instead; try again next time
    }
    return idCache.ids;
}

/**
 * A clickable command mention, or plain `/name` if its ID isn't known.
 * @param {Map<string, string>} ids
 * @param {string} path - e.g. "level rank"
 */
export function mention(ids, path) {
    const id = ids.get(path.split(' ')[0]);
    return id ? `</${path}:${id}>` : `\`/${path}\``;
}

/** "ManageGuild" → "Manage Guild" → Discord's own wording where it differs. */
const PERMISSION_NAMES = {
    ManageGuild: 'Manage Server',
    ModerateMembers: 'Timeout Members',
    ManageGuildExpressions: 'Manage Expressions',
};

/**
 * Who can see a command, from its default member permissions.
 * @param {string | null | undefined} bits
 * @returns {string[]}
 */
export function permissionNames(bits) {
    if (!bits || bits === '0') return [];
    return new PermissionsBitField(BigInt(bits))
        .toArray()
        .map((name) => PERMISSION_NAMES[name] ?? name.replace(/([a-z])([A-Z])/g, '$1 $2'));
}

/**
 * Every usable line of a command: one per subcommand, e.g. ["level rank", "Your rank card"].
 * @param {any} json - commandData.toJSON()
 * @returns {{ path: string, description: string, options: any[] }[]}
 */
export function commandEntries(json) {
    const subs = (json.options ?? []).filter((option) => option.type === ApplicationCommandOptionType.Subcommand);
    const groups = (json.options ?? []).filter(
        (option) => option.type === ApplicationCommandOptionType.SubcommandGroup
    );
    if (subs.length === 0 && groups.length === 0) {
        return [{ path: json.name, description: json.description ?? '', options: json.options ?? [] }];
    }
    return [
        ...subs.map((sub) => ({
            path: `${json.name} ${sub.name}`,
            description: sub.description,
            options: sub.options ?? [],
        })),
        ...groups.flatMap((group) =>
            (group.options ?? []).map((sub) => ({
                path: `${json.name} ${group.name} ${sub.name}`,
                description: sub.description,
                options: sub.options ?? [],
            }))
        ),
    ];
}

/**
 * @param {import('discord.js').Client} client
 * @param {HelpContext} help
 * @param {string} selected - The category shown, or "overview"
 */
function menu(client, help, selected) {
    const t = (key) => Translate(`commands.help.${key}`, help.locale);
    const commands = [...client.commands.values()];
    const options = [
        { label: t('overview'), value: 'overview', emoji: '👋', description: t('overview_short') },
        ...CATEGORIES.filter(
            (category) => categoryCommands(commands, category.id, help.context, help.disabled).length > 0
        ).map((category) => ({
            label: t(`categories.${category.id}.name`),
            value: category.id,
            emoji: category.emoji,
            description: t(`categories.${category.id}.short`).slice(0, 100),
        })),
    ].map((option) => ({ ...option, default: option.value === selected }));

    return /** @type {ActionRowBuilder<StringSelectMenuBuilder>} */ (new ActionRowBuilder()).addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(HELP_MENU_ID)
            .setPlaceholder(t('menu_placeholder'))
            .addOptions(options)
    );
}

/** @param {string} locale */
function links(locale) {
    const t = (key) => Translate(`commands.help.${key}`, locale);
    const buttons = [
        ENV.DASHBOARD && [t('link_dashboard'), ENV.DASHBOARD.URL],
        [t('link_invite'), inviteUrl(ENV.APPLICATION_ID)],
        [t('link_support'), SUPPORT_URL],
        [t('link_vote'), voteUrl()],
    ].filter(Boolean);
    return /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        buttons.map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url))
    );
}

/**
 * The first page: what Ovx does and how to get started.
 * @param {import('discord.js').Client} client
 * @param {HelpContext} help
 * @param {{ canManage: boolean }} viewer - Whether they can set Ovx up in this server
 */
export async function overviewPage(client, help, { canManage }) {
    const t = (key, vars) => Translate(`commands.help.${key}`, help.locale, vars);
    const m = (path) => mention(help.ids, path);
    const commands = [...client.commands.values()];

    const start = help.guildId
        ? [
              canManage
                  ? t('start_admin', { dashboard: m('dashboard') })
                  : t('start_admin_other', { dashboard: m('dashboard') }),
              t('start_members', { rank: m('level rank'), giveaways: m('giveaway list'), vote: m('vote') }),
          ]
        : [t('start_dm', { translate: m('translate'), avatar: m('avatar') })];

    const categories = CATEGORIES.map((category) => ({
        category,
        count: categoryCommands(commands, category.id, help.context, help.disabled).length,
    }))
        .filter(({ count }) => count > 0)
        .map(
            ({ category }) =>
                `${category.emoji} **${t(`categories.${category.id}.name`)}**: ${t(`categories.${category.id}.short`)}`
        );

    const embed = new EmbedBuilder()
        .setColor(await brandColour(help.guildId))
        .setTitle(t('title'))
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
        .setDescription([t('intro'), '', `**${t('getting_started')}**`, ...start.map((line) => `• ${line}`)].join('\n'))
        .addFields(
            { name: t('categories_title'), value: categories.join('\n') },
            {
                name: t('dashboard_title'),
                value: [
                    t('dashboard_intro'),
                    DASHBOARD_FEATURES.map((key) => t(`dashboard_features.${key}`)).join(' · '),
                ].join('\n'),
            }
        )
        .setFooter({ text: t('footer') });

    return { embeds: [embed], components: [menu(client, help, 'overview'), links(help.locale)] };
}

/**
 * One category's commands, each with what it does.
 * @param {import('discord.js').Client} client
 * @param {HelpContext} help
 * @param {string} categoryId
 */
export async function categoryPage(client, help, categoryId) {
    const t = (key, vars) => Translate(`commands.help.${key}`, help.locale, vars);
    const category = CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return null;

    const lines = [];
    for (const command of categoryCommands(client.commands.values(), categoryId, help.context, help.disabled)) {
        const json = command.commandData.toJSON();
        if (json.type === ApplicationCommandType.Message || json.type === ApplicationCommandType.User) {
            lines.push(
                `**${json.name}**: ${t('context_menu', { where: t(json.type === ApplicationCommandType.Message ? 'on_message' : 'on_user') })}`
            );
            continue;
        }
        for (const entry of commandEntries(json)) lines.push(`${mention(help.ids, entry.path)}: ${entry.description}`);
    }

    const embed = new EmbedBuilder()
        .setColor(await brandColour(help.guildId))
        .setTitle(`${category.emoji} ${t(`categories.${category.id}.name`)}`)
        .setDescription([t(`categories.${category.id}.long`), '', ...lines].join('\n').slice(0, 4096))
        .setFooter({ text: t('footer') });

    return { embeds: [embed], components: [menu(client, help, categoryId), links(help.locale)] };
}

/**
 * Full details of one command: what each subcommand does, its options, who can use it and where.
 * @param {Command} command
 * @param {HelpContext} help
 */
export async function commandPage(command, help) {
    const t = (key, vars) => Translate(`commands.help.${key}`, help.locale, vars);
    const json = /** @type {any} */ (command.commandData.toJSON());

    const sections = commandEntries(json).map((entry) => {
        const options = entry.options.map(
            (option) => ` - \`${option.name}\`${option.required ? ` (${t('required')})` : ''}: ${option.description}`
        );
        return [`${mention(help.ids, entry.path)}: ${entry.description}`, ...options].join('\n');
    });

    const permissions = permissionNames(json.default_member_permissions);
    const contexts = json.contexts ?? [0];
    const where = [
        contexts.includes(0) && t('where_servers'),
        (contexts.includes(1) || contexts.includes(2)) && t('where_dms'),
    ].filter(Boolean);

    const embed = new EmbedBuilder()
        .setColor(await brandColour(help.guildId))
        .setTitle(`/${json.name}`)
        .setDescription([json.description, '', ...sections].join('\n').slice(0, 4096))
        .addFields(
            {
                name: t('who'),
                value: permissions.length > 0 ? t('needs', { permissions: permissions.join(', ') }) : t('everyone'),
                inline: true,
            },
            { name: t('where'), value: where.join(', ') || '-', inline: true },
            { name: t('cooldown'), value: t('seconds', { count: command.meta.cooldown }), inline: true }
        );
    return { embeds: [embed], components: [links(help.locale)] };
}
