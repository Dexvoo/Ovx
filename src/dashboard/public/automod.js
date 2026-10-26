// AutoMod page: Discord's own AutoMod rules, set up by Ovx (spam, mentions, words, links), and Ovx's anti-raid.
import { el, api, apiSend, toast } from './ui.js';
import { card, field, toggle, channelSelect, numberInput, chipPicker, createSettingsState } from './forms.js';

const STATUS_TEXT = {
    active: ['Active in Discord', 'status-ok'],
    paused: ['Switched off in Discord: saving turns it back on', 'status-warn'],
    missing: ['Deleted in Discord: saving sets it up again', 'status-warn'],
};

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderAutomod(container, overview) {
    const { guild, channels, roles } = overview;
    const limits = overview.limits.AUTOMOD;
    const roleOptions = roles.map((role) => ({ id: role.id, label: `@${role.name}` }));
    const channelOptions = channels
        .filter((channel) => channel.type !== 'other')
        .map((channel) => ({ id: channel.id, label: `${channel.type === 'voice' ? '🔊 ' : '# '}${channel.name}` }));

    /** From the last load or save: permissions, each rule's state in Discord, and other rules */
    let live = { canManage: true, status: {}, otherRules: 0 };
    let problems = [];
    /** @type {any} - The settings state, made once the page has loaded */
    let state = null;

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'AutoMod' }),
            el('p', { className: 'page-subtitle', textContent: 'Loading…' }),
        ])
    );

    function statusLine(key) {
        const status = STATUS_TEXT[live.status[key]];
        return status ? el('span', { className: `rule-status ${status[1]}`, textContent: status[0] }) : null;
    }

    const switchField = (label, description, get, set, id) =>
        field({
            label,
            description,
            id,
            control: toggle({
                id,
                label,
                checked: get(),
                onChange: (checked) => {
                    set(checked);
                    state.changed();
                },
            }),
        });

    const number = (label, description, get, set, min, max, id, suffix) =>
        field({
            label,
            description,
            id,
            control: numberInput({
                value: get(),
                min,
                max,
                id,
                suffix,
                onChange: (value) => {
                    set(value);
                    state.changed();
                },
            }),
        });

    /** A box with one entry per line, kept in sync with a list. */
    function linesBox(get, set, placeholder, label) {
        const box = el('textarea', {
            className: 'input textarea',
            rows: 5,
            value: get().join('\n'),
            placeholder,
            'aria-label': label,
            spellcheck: false,
        });
        box.addEventListener('input', () => {
            set(
                box.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
            );
            state.changed();
        });
        return box;
    }

    function ruleCard(title, description, key, children) {
        return card(title, description, [statusLine(key) && el('p', {}, [statusLine(key)]), ...children]);
    }

    function render() {
        const { automod, raid } = state.draft;
        container.replaceChildren(
            ...[
                el('div', { className: 'section-header' }, [
                    el('h1', { className: 'page-title', textContent: 'AutoMod' }),
                    el('p', {
                        className: 'page-subtitle',
                        textContent:
                            'Uses Discord’s own AutoMod, so messages are blocked before anyone sees them. Ovx’s rules appear in Server Settings > AutoMod as “Ovx · …”.',
                    }),
                ]),
                !live.canManage &&
                    el('p', {
                        className: 'notice notice-warn',
                        textContent:
                            'Ovx needs the Manage Server permission to set up AutoMod rules and pause invites. Give its role that permission in Server Settings > Roles.',
                    }),
                live.otherRules > 0 &&
                    el('p', {
                        className: 'notice',
                        textContent: `This server also has ${live.otherRules} AutoMod rule(s) made in Discord. Ovx leaves those alone, but they count towards Discord’s limits (for example, 6 keyword rules).`,
                    }),
                problems.length > 0 &&
                    el(
                        'ul',
                        { className: 'form-errors', role: 'alert' },
                        problems.map((problem) => el('li', { textContent: problem }))
                    ),

                card('Alerts and exceptions', 'Shared by every filter below.', [
                    field({
                        label: 'Alert channel',
                        description:
                            'Discord posts here when a message is blocked, and Ovx posts raid alerts. Keep it staff-only.',
                        id: 'am-alerts',
                        control: channelSelect({
                            channels,
                            value: automod.alertChannelId,
                            noneLabel: 'No alerts',
                            id: 'am-alerts',
                            onChange: (id) => {
                                automod.alertChannelId = id;
                                state.changed();
                            },
                        }),
                    }),
                    field({
                        label: 'Message to the member',
                        description: 'Shown privately when their message is blocked. Leave empty for Discord’s own.',
                        id: 'am-block-message',
                        control: (() => {
                            const input = el('input', {
                                className: 'input input-wide',
                                id: 'am-block-message',
                                type: 'text',
                                maxLength: limits.BLOCK_MESSAGE_MAX,
                                value: automod.blockMessage ?? '',
                                placeholder: 'Your message was blocked by this server’s rules.',
                            });
                            input.addEventListener('input', () => {
                                automod.blockMessage = input.value || null;
                                state.changed();
                            });
                            return input;
                        })(),
                    }),
                    field({
                        label: 'Exempt roles',
                        description: `Members with these roles are never filtered (up to ${limits.EXEMPT_ROLES_MAX}). Admins are always exempt.`,
                        stacked: true,
                        control: chipPicker({
                            options: roleOptions,
                            selected: automod.exemptRoleIds,
                            placeholder: 'Add a role…',
                            emptyText: 'No exempt roles',
                            onChange: (ids) => {
                                automod.exemptRoleIds = ids;
                                state.changed();
                            },
                        }),
                    }),
                    field({
                        label: 'Exempt channels',
                        description: `Nothing is filtered here (up to ${limits.EXEMPT_CHANNELS_MAX}).`,
                        stacked: true,
                        control: chipPicker({
                            options: channelOptions,
                            selected: automod.exemptChannelIds,
                            placeholder: 'Add a channel…',
                            emptyText: 'No exempt channels',
                            onChange: (ids) => {
                                automod.exemptChannelIds = ids;
                                state.changed();
                            },
                        }),
                    }),
                ]),

                ruleCard('Spam', 'Discord’s own spam detection: scam links, copy-pasted spam and similar.', 'spam', [
                    switchField(
                        'Block suspected spam',
                        null,
                        () => automod.spam.enabled,
                        (v) => (automod.spam.enabled = v),
                        'am-spam'
                    ),
                ]),

                ruleCard('Mass mentions', 'Messages that mention lots of members or roles at once.', 'mentions', [
                    switchField(
                        'Block mass mentions',
                        null,
                        () => automod.mentions.enabled,
                        (v) => (automod.mentions.enabled = v),
                        'am-mentions'
                    ),
                    number(
                        'Most mentions',
                        'Unique members and roles in one message.',
                        () => automod.mentions.limit,
                        (v) => (automod.mentions.limit = v),
                        1,
                        limits.MENTION_LIMIT_MAX,
                        'am-mention-limit'
                    ),
                    switchField(
                        'Mention raid protection',
                        'Discord also watches for many members mention-spamming at once.',
                        () => automod.mentions.raidProtection,
                        (v) => (automod.mentions.raidProtection = v),
                        'am-mention-raid'
                    ),
                    number(
                        'Timeout',
                        'Also time the member out. 0 for no timeout.',
                        () => automod.mentions.timeoutMinutes,
                        (v) => (automod.mentions.timeoutMinutes = v),
                        0,
                        limits.TIMEOUT_MINUTES_MAX,
                        'am-mention-timeout',
                        'minutes'
                    ),
                ]),

                ruleCard(
                    'Discord’s word lists',
                    'Lists Discord keeps up to date. Your allowed words (below) apply to them too.',
                    'presets',
                    [
                        switchField(
                            'Insults and slurs',
                            null,
                            () => automod.presets.slurs,
                            (v) => (automod.presets.slurs = v),
                            'am-slurs'
                        ),
                        switchField(
                            'Sexual content',
                            null,
                            () => automod.presets.sexualContent,
                            (v) => (automod.presets.sexualContent = v),
                            'am-sexual'
                        ),
                        switchField(
                            'Severe profanity',
                            null,
                            () => automod.presets.profanity,
                            (v) => (automod.presets.profanity = v),
                            'am-profanity'
                        ),
                    ]
                ),

                ruleCard(
                    'Blocked words',
                    'Your own list, one per line. “cat” blocks just that word, “cat*” words starting with it, and “*cat*” it anywhere.',
                    'words',
                    [
                        switchField(
                            'Block these words',
                            null,
                            () => automod.words.enabled,
                            (v) => (automod.words.enabled = v),
                            'am-words'
                        ),
                        field({
                            label: `Blocked words (up to ${limits.KEYWORDS_MAX})`,
                            stacked: true,
                            control: linesBox(
                                () => automod.words.keywords,
                                (v) => (automod.words.keywords = v),
                                'one word or phrase per line',
                                'Blocked words'
                            ),
                        }),
                        field({
                            label: `Allowed words (up to ${limits.ALLOWED_MAX})`,
                            description: 'Never blocked, even if they match, e.g. “scunthorpe”.',
                            stacked: true,
                            control: linesBox(
                                () => automod.words.allowed,
                                (v) => (automod.words.allowed = v),
                                'one per line',
                                'Allowed words'
                            ),
                        }),
                        number(
                            'Timeout',
                            'Also time the member out. 0 for no timeout.',
                            () => automod.words.timeoutMinutes,
                            (v) => (automod.words.timeoutMinutes = v),
                            0,
                            limits.TIMEOUT_MINUTES_MAX,
                            'am-words-timeout',
                            'minutes'
                        ),
                    ]
                ),

                ruleCard(
                    'Links',
                    'Blocks links, except to the sites you allow. GIFs from the GIF picker and Discord links are allowed by default.',
                    'links',
                    [
                        switchField(
                            'Block links',
                            null,
                            () => automod.links.enabled,
                            (v) => (automod.links.enabled = v),
                            'am-links'
                        ),
                        field({
                            label: `Allowed sites (up to ${limits.SITES_MAX})`,
                            description: 'One per line, like youtube.com. Includes their subdomains.',
                            stacked: true,
                            control: linesBox(
                                () => automod.links.allowedSites,
                                (v) => (automod.links.allowedSites = v),
                                'youtube.com',
                                'Allowed sites'
                            ),
                        }),
                    ]
                ),

                card(
                    'Anti-raid',
                    'Discord has no AutoMod rule for raids, so Ovx watches for a sudden burst of new members itself.',
                    [
                        switchField(
                            'Watch for raids',
                            'Needs an alert channel above.',
                            () => raid.enabled,
                            (v) => (raid.enabled = v),
                            'am-raid'
                        ),
                        number(
                            'Joins',
                            'This many members joining…',
                            () => raid.joins,
                            (v) => (raid.joins = v),
                            limits.RAID_JOINS_MIN,
                            limits.RAID_JOINS_MAX,
                            'am-raid-joins'
                        ),
                        number(
                            'Within',
                            '…this quickly counts as a raid.',
                            () => raid.seconds,
                            (v) => (raid.seconds = v),
                            limits.RAID_SECONDS_MIN,
                            limits.RAID_SECONDS_MAX,
                            'am-raid-seconds',
                            'seconds'
                        ),
                        field({
                            label: 'During a raid',
                            description:
                                'For members who joined in the burst, and anyone joining in the 10 minutes after.',
                            id: 'am-raid-action',
                            control: (() => {
                                const select = el(
                                    'select',
                                    { className: 'select', id: 'am-raid-action' },
                                    [
                                        ['alert', 'Just alert staff'],
                                        ['timeout', 'Time them out for an hour'],
                                        ['kick', 'Kick them'],
                                    ].map(([value, label]) =>
                                        el('option', { value, textContent: label, selected: raid.action === value })
                                    )
                                );
                                select.addEventListener('change', () => {
                                    raid.action = select.value;
                                    state.changed();
                                });
                                return select;
                            })(),
                        }),
                        number(
                            'Pause invites',
                            'Stop new people joining for a while when a raid starts. 0 to keep invites open.',
                            () => raid.pauseInvitesHours,
                            (v) => (raid.pauseInvitesHours = v),
                            0,
                            limits.PAUSE_HOURS_MAX,
                            'am-raid-pause',
                            'hours'
                        ),
                        field({
                            label: 'Ping',
                            description: 'Mentioned in the raid alert.',
                            id: 'am-raid-ping',
                            control: (() => {
                                const select = el('select', { className: 'select', id: 'am-raid-ping' }, [
                                    el('option', { value: '', textContent: 'Nobody' }),
                                    ...roles.map((role) =>
                                        el('option', { value: role.id, textContent: `@${role.name}` })
                                    ),
                                ]);
                                select.value = raid.pingRoleId ?? '';
                                select.addEventListener('change', () => {
                                    raid.pingRoleId = select.value || null;
                                    state.changed();
                                });
                                return select;
                            })(),
                        }),
                        number(
                            'Minimum account age',
                            'Accounts newer than this are removed when they join, and told when they can come back. Works even with raid watching off. 0 for no minimum.',
                            () => raid.minAccountDays,
                            (v) => (raid.minAccountDays = v),
                            0,
                            limits.ACCOUNT_DAYS_MAX,
                            'am-raid-age',
                            'days'
                        ),
                    ]
                ),

                state.bar,
            ].filter(Boolean)
        );
        state.changed();
    }

    (async () => {
        const { status, data } = await api(`/api/guilds/${guild.id}/automod`);
        if (status !== 200) {
            toast(data?.error ?? 'Could not load AutoMod.', 'error');
            return;
        }
        live = { canManage: data.canManage, status: data.status, otherRules: data.otherRules };
        state = createSettingsState({
            saved: { automod: data.automod, raid: data.raid },
            onReset: () => render(),
            async onSave(draft) {
                const { status: code, data: saved } = await apiSend('PUT', `/api/guilds/${guild.id}/automod`, draft);
                if (code !== 200)
                    return { ok: false, errors: saved?.details ?? [saved?.error ?? 'Could not save. Try again.'] };
                live = { canManage: saved.canManage, status: saved.status, otherRules: saved.otherRules };
                problems = saved.problems ?? [];
                if (problems.length) toast('Saved, but some rules could not be set up in Discord', 'error');
                else toast('AutoMod saved');
                return { ok: true, saved: { automod: saved.automod, raid: saved.raid } };
            },
        });
        render();
    })();

    return () => state?.dispose();
}
