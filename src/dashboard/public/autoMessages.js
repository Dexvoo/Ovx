// Auto Messages page: messages posted on a repeat, and sticky messages kept at the bottom of a channel.
import { el, api, apiSend, toast } from './ui.js';
import { card, field, toggle, channelSelect, textArea, confirmDialog } from './forms.js';

/** @type {[string, number][]} */
const UNITS = [
    ['minutes', 1],
    ['hours', 60],
    ['days', 1440],
];

/** 90 → "every 90 minutes", 120 → "every 2 hours" */
function every(minutes) {
    if (minutes % 1440 === 0) return `every ${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
    if (minutes % 60 === 0) return `every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
    return `every ${minutes} minutes`;
}

/** The biggest unit that divides the interval evenly, for the editor. */
function splitInterval(minutes) {
    const [unit, size] = [...UNITS].reverse().find(([, size]) => minutes % size === 0);
    return { amount: minutes / size, unit, size };
}

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderAutoMessages(container, overview) {
    const { guild, channels } = overview;
    const limits = overview.limits.AUTO_MESSAGES;
    let autoMessages = [];
    let stickies = [];
    let loaded = false;
    let busy = false;
    /** @type {{ kind: 'auto' | 'sticky', id: string | null, draft: any } | null} */
    let editing = null;
    const body = el('div');
    const base = `/api/guilds/${guild.id}/auto-messages`;
    const channelName = (id) => `#${channels.find((c) => c.id === id)?.name ?? 'deleted-channel'}`;

    function apply(data) {
        autoMessages = data.autoMessages;
        stickies = data.stickies;
        loaded = true;
    }

    async function load() {
        const { status, data } = await api(base);
        if (status !== 200) return toast(data?.error ?? 'Could not load auto messages.', 'error');
        apply(data);
        render();
    }

    async function run(request, success) {
        busy = true;
        render();
        const { status, data } = await request();
        busy = false;
        if (status !== 200) {
            const details = data?.details?.length ? ` ${data.details.join(' ')}` : '';
            toast(`${data?.error ?? 'That didn’t work. Try again.'}${details}`, 'error');
        } else {
            apply(data);
            editing = null;
            toast(success);
        }
        render();
    }

    function remove(kind, item) {
        return async () => {
            const confirmed = await confirmDialog({
                title: kind === 'auto' ? 'Delete this auto message?' : 'Delete this sticky message?',
                message:
                    kind === 'auto'
                        ? 'It stops being posted. Messages already posted stay.'
                        : 'Its message at the bottom of the channel is deleted too.',
                confirmLabel: 'Delete',
            });
            if (confirmed) run(() => apiSend('DELETE', `${base}/${kind}/${item.id}`, {}), 'Deleted');
        };
    }

    function button(text, className, onClick, disabled = busy) {
        const node = el('button', { type: 'button', className: `button ${className}`, textContent: text, disabled });
        node.addEventListener('click', onClick);
        return node;
    }

    function startEditing(kind, item) {
        editing = {
            kind,
            id: item?.id ?? null,
            draft: item
                ? structuredClone(item)
                : { channelId: null, content: '', intervalMinutes: 60, enabled: true, skipIfQuiet: true },
        };
        render();
    }

    function editor() {
        const { kind, id, draft } = editing;
        const prefix = `am-${kind}`;
        const fields = [
            field({
                label: 'Channel',
                description: kind === 'sticky' ? 'One sticky message per channel.' : null,
                id: `${prefix}-channel`,
                control: channelSelect({
                    channels,
                    value: draft.channelId,
                    noneLabel: 'Choose a channel',
                    id: `${prefix}-channel`,
                    onChange: (value) => (draft.channelId = value),
                }),
            }),
            field({
                label: 'Message',
                description: 'Discord formatting works. Mentions show but never ping anyone.',
                id: `${prefix}-content`,
                stacked: true,
                control: textArea({
                    value: draft.content,
                    maxLength: limits.CONTENT_MAX,
                    placeholder:
                        kind === 'auto'
                            ? 'Remember to read the rules in #rules!'
                            : 'Please keep this channel on topic.',
                    id: `${prefix}-content`,
                    onChange: (value) => (draft.content = value),
                }),
            }),
        ];

        if (kind === 'auto') {
            const { amount, size } = splitInterval(draft.intervalMinutes);
            const amountInput = el('input', {
                className: 'input input-number',
                type: 'number',
                inputMode: 'numeric',
                min: 1,
                step: 1,
                value: amount,
                id: `${prefix}-interval`,
            });
            const unitSelect = el(
                'select',
                { className: 'select', 'aria-label': 'Unit' },
                UNITS.map(([unit, unitSize]) =>
                    el('option', { value: String(unitSize), textContent: unit, selected: unitSize === size })
                )
            );
            const updateInterval = () => {
                const minutes = Number(amountInput.value) * Number(unitSelect.value);
                const valid =
                    Number.isInteger(minutes) && minutes >= limits.INTERVAL_MIN && minutes <= limits.INTERVAL_MAX;
                amountInput.setCustomValidity(valid ? '' : `Between ${limits.INTERVAL_MIN} minutes and 7 days`);
                draft.intervalMinutes = minutes;
            };
            amountInput.addEventListener('input', updateInterval);
            unitSelect.addEventListener('change', updateInterval);
            fields.push(
                field({
                    label: 'Post it every',
                    description: `From ${limits.INTERVAL_MIN} minutes to 7 days. Changing it restarts the countdown.`,
                    id: `${prefix}-interval`,
                    control: el('div', { className: 'inline-controls' }, [amountInput, unitSelect]),
                }),
                field({
                    label: 'Skip if nobody talked',
                    description: 'Don’t post again if the last auto message is still the newest message there.',
                    id: `${prefix}-quiet`,
                    control: toggle({
                        checked: draft.skipIfQuiet,
                        label: 'Skip if nobody talked',
                        id: `${prefix}-quiet`,
                        onChange: (checked) => (draft.skipIfQuiet = checked),
                    }),
                }),
                field({
                    label: 'On',
                    description: 'Turn it off to pause it without deleting it.',
                    id: `${prefix}-enabled`,
                    control: toggle({
                        checked: draft.enabled,
                        label: 'On',
                        id: `${prefix}-enabled`,
                        onChange: (checked) => (draft.enabled = checked),
                    }),
                })
            );
        }

        const save = button(busy ? 'Saving…' : 'Save', 'button-primary', () => {
            const payload = kind === 'auto' ? draft : { channelId: draft.channelId, content: draft.content };
            run(
                () => apiSend(id ? 'PUT' : 'POST', id ? `${base}/${kind}/${id}` : `${base}/${kind}`, payload),
                kind === 'sticky' ? 'Saved and posted at the bottom of the channel' : 'Saved'
            );
        });
        const cancel = button('Cancel', 'button-ghost', () => {
            editing = null;
            render();
        });
        return el('div', { className: 'giveaway-editor' }, [
            ...fields,
            el('div', { className: 'card-actions' }, [cancel, save]),
        ]);
    }

    function row(kind, item) {
        const preview = item.content.length > 140 ? `${item.content.slice(0, 140)}…` : item.content;
        const meta =
            kind === 'auto'
                ? `${every(item.intervalMinutes)}${item.enabled ? ` · next ${new Date(item.nextRunAt).toLocaleString()}` : ''}`
                : 'Reposted at the bottom after people chat';
        return el('article', { className: 'giveaway-row' }, [
            el('div', { className: 'giveaway-main' }, [
                el(
                    'div',
                    { className: 'giveaway-title-line' },
                    [
                        el('span', { className: 'giveaway-prize', textContent: channelName(item.channelId) }),
                        kind === 'auto' && !item.enabled && el('span', { className: 'case-badge', textContent: 'Off' }),
                    ].filter(Boolean)
                ),
                el('p', { className: 'case-reason', textContent: preview }),
                el('p', { className: 'case-meta', textContent: meta }),
            ]),
            el('div', { className: 'giveaway-actions' }, [
                button('Edit', 'button-ghost button-small', () => startEditing(kind, item), busy || Boolean(editing)),
                button('Delete', 'button-danger-ghost button-small', remove(kind, item)),
            ]),
        ]);
    }

    function section(kind, title, description, items, max, empty) {
        const isEditing = editing?.kind === kind;
        const add = button(
            `+ Add ${kind === 'auto' ? 'auto message' : 'sticky message'}`,
            'button-primary',
            () => startEditing(kind, null),
            busy || !loaded || Boolean(editing) || items.length >= max
        );
        return card(title, description, [
            !loaded
                ? el('p', { className: 'empty-note', textContent: 'Loading…' })
                : items.length === 0 && !isEditing
                  ? el('p', { className: 'empty-note', textContent: empty })
                  : el(
                        'div',
                        { className: 'giveaway-list' },
                        items.map((item) => (isEditing && editing.id === item.id ? editor() : row(kind, item)))
                    ),
            isEditing && !editing.id ? editor() : el('div', { className: 'card-actions' }, [add]),
        ]);
    }

    function render() {
        body.replaceChildren(
            section(
                'auto',
                'Auto messages',
                `Posted in a channel on a repeat, like a reminder to read the rules. Up to ${limits.AUTO_MAX}.`,
                autoMessages,
                limits.AUTO_MAX,
                'No auto messages yet.'
            ),
            section(
                'sticky',
                'Sticky messages',
                `Kept as the newest message in a channel: Ovx reposts it a few seconds after people stop chatting. Up to ${limits.STICKY_MAX}.`,
                stickies,
                limits.STICKY_MAX,
                'No sticky messages yet.'
            )
        );
    }

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Auto Messages' }),
            el('p', {
                className: 'page-subtitle',
                textContent: 'Post messages on a timer, or keep one pinned to the bottom of a channel.',
            }),
        ]),
        body
    );
    render();
    load();
    return () => {};
}
