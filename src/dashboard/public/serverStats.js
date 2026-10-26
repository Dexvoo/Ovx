// Server Stats page: voice channels whose names show a number, like "👥 Members: 9,257".
import { el, api, apiSend, toast } from './ui.js';
import { card, confirmDialog } from './forms.js';

const TYPES = [
    ['members', 'Members (everyone)'],
    ['humans', 'People (not bots)'],
    ['bots', 'Bots'],
    ['boosts', 'Server boosts'],
    ['channels', 'Channels'],
    ['roles', 'Roles'],
    ['role', 'Members with a role'],
];
const TYPE_NAMES = Object.fromEntries(TYPES);

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderServerStats(container, overview) {
    const { guild, roles } = overview;
    const limits = overview.limits.SERVER_STATS;
    let counters = [];
    let loaded = false;
    let busy = false;
    let addType = 'members';
    let addRole = null;
    const body = el('div');

    async function load() {
        const { status, data } = await api(`/api/guilds/${guild.id}/server-stats`);
        if (status !== 200) return toast(data?.error ?? 'Could not load server stats.', 'error');
        counters = data.counters;
        loaded = true;
        render();
    }

    async function run(request, success) {
        busy = true;
        render();
        const { status, data } = await request();
        busy = false;
        if (status !== 200) toast(data?.error ?? 'That didn’t work. Try again.', 'error');
        else {
            counters = data.counters;
            toast(success);
        }
        render();
    }

    function counterRow(counter) {
        const template = el('input', {
            className: 'input input-wide',
            type: 'text',
            value: counter.template,
            maxLength: limits.TEMPLATE_MAX,
            'aria-label': 'Channel name',
        });
        const save = el('button', {
            type: 'button',
            className: 'button button-ghost button-small',
            textContent: 'Save name',
            disabled: busy,
        });
        save.addEventListener('click', () =>
            run(
                () =>
                    apiSend('PUT', `/api/guilds/${guild.id}/server-stats/${counter.channelId}`, {
                        template: template.value,
                    }),
                'Name saved. Discord may take a few minutes to show it.'
            )
        );
        const remove = el('button', {
            type: 'button',
            className: 'button button-danger-ghost button-small',
            textContent: 'Remove',
            disabled: busy,
        });
        remove.addEventListener('click', async () => {
            const confirmed = await confirmDialog({
                title: 'Remove this counter?',
                message: 'Its channel is deleted from Discord.',
                confirmLabel: 'Remove',
            });
            if (confirmed)
                run(
                    () => apiSend('DELETE', `/api/guilds/${guild.id}/server-stats/${counter.channelId}`, {}),
                    'Counter removed'
                );
        });

        const role = counter.roleId ? roles.find((item) => item.id === counter.roleId) : null;
        return el('article', { className: 'giveaway-row' }, [
            el(
                'div',
                { className: 'giveaway-main' },
                [
                    el('div', { className: 'giveaway-title-line' }, [
                        el('span', {
                            className: 'case-badge',
                            textContent: `${TYPE_NAMES[counter.type]}${role ? `: @${role.name}` : ''}`,
                        }),
                        el('span', {
                            className: 'giveaway-prize',
                            textContent: `🔊 ${counter.name ?? counter.preview}`,
                        }),
                    ]),
                    !counter.exists &&
                        el('p', {
                            className: 'notice notice-warn',
                            textContent: 'Its channel was deleted in Discord. Remove this counter and add it again.',
                        }),
                    el('div', { className: 'inline-controls' }, [template, save]),
                    el('p', {
                        className: 'case-meta',
                        textContent: `{count} is the number${counter.type === 'role' ? ', {role} the role’s name' : ''}.`,
                    }),
                ].filter(Boolean)
            ),
            el('div', { className: 'giveaway-actions' }, [remove]),
        ]);
    }

    function render() {
        const typeSelect = el(
            'select',
            { className: 'select', 'aria-label': 'What to count' },
            TYPES.map(([value, label]) => el('option', { value, textContent: label, selected: value === addType }))
        );
        typeSelect.addEventListener('change', () => {
            addType = typeSelect.value;
            render();
        });
        const roleSelect =
            addType === 'role' &&
            el('select', { className: 'select', 'aria-label': 'Role' }, [
                el('option', { value: '', textContent: 'Choose a role' }),
                ...roles.map((role) =>
                    el('option', { value: role.id, textContent: `@${role.name}`, selected: role.id === addRole })
                ),
            ]);
        roleSelect?.addEventListener('change', () => (addRole = roleSelect.value || null));
        const add = el('button', {
            type: 'button',
            className: 'button button-primary',
            textContent: busy ? 'Working…' : '+ Add counter',
            disabled: busy || !loaded || counters.length >= limits.COUNTERS_MAX,
        });
        add.addEventListener('click', () =>
            run(
                () => apiSend('POST', `/api/guilds/${guild.id}/server-stats`, { type: addType, roleId: addRole }),
                'Counter added'
            )
        );

        body.replaceChildren(
            card(
                'Counters',
                `Each is a voice channel everyone can see but nobody can join. Up to ${limits.COUNTERS_MAX}. They update every 10 minutes (Discord limits how often channels can be renamed).`,
                [
                    !loaded
                        ? el('p', { className: 'empty-note', textContent: 'Loading…' })
                        : counters.length === 0
                          ? el('p', {
                                className: 'empty-note',
                                textContent:
                                    'No counters yet. Add one below: Ovx makes a “📊 Server Stats” category for them.',
                            })
                          : el('div', { className: 'giveaway-list' }, counters.map(counterRow)),
                    el('div', { className: 'card-actions' }, [typeSelect, roleSelect, add].filter(Boolean)),
                ]
            )
        );
    }

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Server Stats' }),
            el('p', {
                className: 'page-subtitle',
                textContent: 'Show live numbers, like your member count, as channels at the top of your server.',
            }),
        ]),
        body
    );
    render();
    load();
    return () => {};
}
