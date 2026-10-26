// Giveaways page: start or schedule a giveaway, manage the ones running and ended, and choose who else can run them.
import { el, api, apiSend, toast } from './ui.js';
import {
    card,
    field,
    channelSelect,
    numberInput,
    textArea,
    chipPicker,
    confirmDialog,
    createSettingsState,
    toggle,
} from './forms.js';

const REFRESH_MS = 30_000;
const DURATION_PRESETS = ['1h', '12h', '1d', '3d', '1w'];
const STATUS_LABELS = { running: 'Running', scheduled: 'Scheduled', ended: 'Ended', cancelled: 'Cancelled' };

const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "in 3 hours", "2 days ago" */
function relative(iso) {
    if (!iso) return 'at an unknown time';
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    /** @type {[Intl.RelativeTimeFormatUnit, number][]} */
    const units = [
        ['day', 86_400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
    }
    return relativeTime.format(Math.round(seconds), 'second');
}

/** The value for a datetime-local input, in the browser's time zone. */
function localInputValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const emptyForm = () => ({
    prize: '',
    description: '',
    channelId: null,
    winnerCount: 1,
    duration: '1d',
    schedule: false,
    startsAt: '',
    roleIds: [],
    minLevel: 0,
    voteBonus: 0,
});

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderGiveaways(container, overview) {
    const { guild, channels, roles } = overview;
    const limits = overview.limits.GIVEAWAYS;
    const roleOptions = roles.map((role) => ({ id: role.id, label: `@${role.name}` }));
    const channelName = (id) => `#${channels.find((channel) => channel.id === id)?.name ?? 'deleted-channel'}`;
    const roleName = (id) => `@${roles.find((role) => role.id === id)?.name ?? 'deleted-role'}`;

    let giveaways = [];
    let loaded = false;
    let form = emptyForm();
    let creating = false;
    let formErrors = [];

    const formHost = el('div');
    const listHost = el('div');
    const settingsHost = el('div');

    // ---------- Giveaway managers ----------

    const state = createSettingsState({
        saved: { managerRoleIds: [] },
        onReset: () => renderSettings(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/giveaway-settings`, draft);
            if (status === 200) {
                toast('Giveaway managers saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    function renderSettings() {
        settingsHost.replaceChildren(
            card(
                'Giveaway managers',
                'Members with Manage Server can always run giveaways. Members with one of these roles can too, with /giveaway in Discord.',
                [
                    field({
                        label: 'Manager roles',
                        stacked: true,
                        control: chipPicker({
                            options: roleOptions,
                            selected: state.draft.managerRoleIds,
                            placeholder: 'Add a role…',
                            emptyText: 'Only members with Manage Server',
                            onChange: (ids) => {
                                state.draft.managerRoleIds = ids;
                                state.changed();
                            },
                        }),
                    }),
                ]
            )
        );
        state.changed();
    }

    // ---------- New giveaway ----------

    async function submit() {
        if (creating) return;
        creating = true;
        formErrors = [];
        renderForm();

        const body = {
            prize: form.prize,
            description: form.description,
            channelId: form.channelId,
            winnerCount: form.winnerCount,
            duration: form.duration,
            startsAt: form.schedule && form.startsAt ? new Date(form.startsAt).toISOString() : '',
            roleIds: form.roleIds,
            minLevel: form.minLevel,
            voteBonus: overview.votesEnabled ? form.voteBonus : 0,
        };
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/giveaways`, body);
        creating = false;

        if (status === 200) {
            toast(data.status === 'scheduled' ? 'Giveaway scheduled' : 'Giveaway started');
            form = emptyForm();
            giveaways = [data, ...giveaways];
            renderList();
        } else {
            formErrors = data?.details ?? [data?.error ?? 'Could not start the giveaway. Try again.'];
        }
        renderForm();
    }

    function textInput(value, { maxLength, placeholder, id, onInput }) {
        const input = el('input', { className: 'input input-wide', type: 'text', value, maxLength, placeholder, id });
        input.addEventListener('input', () => onInput(input.value));
        return input;
    }

    function renderForm() {
        const durationInput = textInput(form.duration, {
            maxLength: 40,
            placeholder: 'e.g. 1d 12h',
            id: 'giveaway-duration',
            onInput: (value) => (form.duration = value),
        });
        const presets = el(
            'div',
            { className: 'preset-row' },
            DURATION_PRESETS.map((preset) => {
                const button = el('button', {
                    type: 'button',
                    className: 'button button-ghost button-small',
                    textContent: preset,
                });
                button.addEventListener('click', () => {
                    form.duration = preset;
                    durationInput.value = preset;
                });
                return button;
            })
        );

        const startInput = el('input', {
            className: 'input',
            type: 'datetime-local',
            id: 'giveaway-start',
            value: form.startsAt,
            min: localInputValue(new Date()),
            disabled: !form.schedule,
        });
        startInput.addEventListener('input', () => (form.startsAt = startInput.value));

        const button = el('button', {
            type: 'button',
            className: 'button button-primary',
            textContent: creating ? 'Working…' : form.schedule ? 'Schedule giveaway' : 'Start giveaway',
            disabled: creating,
        });
        button.addEventListener('click', submit);

        formHost.replaceChildren(
            card('New giveaway', 'Posts a giveaway with an Enter button. Winners are drawn when it ends.', [
                field({
                    label: 'Prize',
                    id: 'giveaway-prize',
                    control: textInput(form.prize, {
                        maxLength: limits.PRIZE_MAX,
                        placeholder: 'e.g. Discord Nitro',
                        id: 'giveaway-prize',
                        onInput: (value) => (form.prize = value),
                    }),
                }),
                field({
                    label: 'Description',
                    description: 'Optional: details about the prize or how to claim it.',
                    stacked: true,
                    control: textArea({
                        value: form.description,
                        maxLength: limits.DESCRIPTION_MAX,
                        onChange: (value) => (form.description = value),
                    }),
                }),
                field({
                    label: 'Channel',
                    id: 'giveaway-channel',
                    control: channelSelect({
                        channels,
                        value: form.channelId,
                        noneLabel: 'Choose a channel',
                        id: 'giveaway-channel',
                        onChange: (id) => (form.channelId = id),
                    }),
                }),
                field({
                    label: 'Winners',
                    id: 'giveaway-winners',
                    control: numberInput({
                        value: form.winnerCount,
                        min: 1,
                        max: limits.WINNERS_MAX,
                        id: 'giveaway-winners',
                        onChange: (value) => (form.winnerCount = value),
                    }),
                }),
                field({
                    label: 'Runs for',
                    description: 'Like 30m, 12h, 3d or 1w.',
                    id: 'giveaway-duration',
                    control: el('div', { className: 'stack' }, [durationInput, presets]),
                }),
                field({
                    label: 'Schedule for later',
                    description: 'Post it automatically at a set time, in your time zone.',
                    control: el('div', { className: 'inline-controls' }, [
                        toggle({
                            checked: form.schedule,
                            label: 'Schedule for later',
                            onChange: (checked) => {
                                form.schedule = checked;
                                if (checked && !form.startsAt) {
                                    form.startsAt = localInputValue(new Date(Date.now() + 60 * 60_000));
                                }
                                renderForm();
                            },
                        }),
                        startInput,
                    ]),
                }),
                field({
                    label: 'Required roles',
                    description: 'Members need at least one of these to enter. Leave empty for everyone.',
                    stacked: true,
                    control: chipPicker({
                        options: roleOptions,
                        selected: form.roleIds,
                        placeholder: 'Add a role…',
                        emptyText: 'Anyone can enter',
                        onChange: (ids) => (form.roleIds = ids),
                    }),
                }),
                field({
                    label: 'Minimum level',
                    description: 'Only members at this Ovx level or higher can enter. 0 for no minimum.',
                    id: 'giveaway-level',
                    control: numberInput({
                        value: form.minLevel,
                        min: 0,
                        max: limits.LEVEL_MAX,
                        id: 'giveaway-level',
                        onChange: (value) => (form.minLevel = value),
                    }),
                }),
                overview.votesEnabled
                    ? field({
                          label: 'Bonus entries for voting',
                          description:
                              'Extra entries for members who voted for Ovx on Top.gg in the last 12 hours. 0 for none.',
                          id: 'giveaway-vote',
                          control: numberInput({
                              value: form.voteBonus,
                              min: 0,
                              max: limits.VOTE_BONUS_MAX,
                              id: 'giveaway-vote',
                              onChange: (value) => (form.voteBonus = value),
                          }),
                      })
                    : el('p', {
                          className: 'empty-note',
                          textContent: 'Bonus entries for Top.gg votes will be available once votes are set up.',
                      }),
                formErrors.length > 0 &&
                    el(
                        'ul',
                        { className: 'form-errors', role: 'alert' },
                        formErrors.map((error) => el('li', { textContent: error }))
                    ),
                el('div', { className: 'card-actions' }, [button]),
            ])
        );
    }

    // ---------- Giveaway list ----------

    /**
     * Runs an action on a giveaway after confirming, then shows its new state.
     * @param {any} giveaway
     * @param {'end' | 'reroll' | 'cancel' | 'delete'} op
     */
    async function act(giveaway, op) {
        const prompts = {
            end: ['End this giveaway now?', 'Winners will be drawn and announced straight away.', 'End now'],
            reroll: [
                'Draw a new winner?',
                'One new winner is drawn from the entrants who haven’t won yet, and announced in the channel.',
                'Reroll',
            ],
            cancel: ['Cancel this giveaway?', 'Nobody will win, and it can’t be restarted.', 'Cancel giveaway'],
            delete: [
                'Delete this giveaway?',
                'It’s removed from this list along with its entries. The message in Discord is left as it is.',
                'Delete',
            ],
        };
        const [title, message, confirmLabel] = prompts[op];
        if (!(await confirmDialog({ title, message, confirmLabel }))) return;

        const path = `/api/guilds/${guild.id}/giveaways/${giveaway.id}`;
        const { status, data } =
            op === 'delete' ? await apiSend('DELETE', path, {}) : await apiSend('POST', `${path}/${op}`, {});
        if (status !== 200) {
            toast(data?.error ?? 'That didn’t work. Try again.', 'error');
            return refresh();
        }

        giveaways =
            op === 'delete'
                ? giveaways.filter((item) => item.id !== giveaway.id)
                : giveaways.map((item) => (item.id === giveaway.id ? data : item));
        toast(
            {
                end: 'Giveaway ended',
                reroll: 'New winner drawn',
                cancel: 'Giveaway cancelled',
                delete: 'Giveaway deleted',
            }[op]
        );
        renderList();
    }

    function actionButton(label, giveaway, op, danger = false) {
        const button = el('button', {
            type: 'button',
            className: `button ${danger ? 'button-danger-ghost' : 'button-ghost'} button-small`,
            textContent: label,
        });
        button.addEventListener('click', async () => {
            button.disabled = true;
            await act(giveaway, op);
            button.disabled = false;
        });
        return button;
    }

    function giveawayRow(giveaway) {
        const timing = {
            running: `Ends ${relative(giveaway.endsAt)}`,
            scheduled: `Starts ${relative(giveaway.startsAt)}`,
            ended: `Ended ${relative(giveaway.endedAt ?? giveaway.endsAt)}`,
            cancelled: `Cancelled ${relative(giveaway.endedAt ?? giveaway.endsAt)}`,
        }[giveaway.status];
        const timingDate =
            { running: giveaway.endsAt, scheduled: giveaway.startsAt }[giveaway.status] ?? giveaway.endedAt;

        const requirements = [
            ...giveaway.requirements.roleIds.map(roleName),
            giveaway.requirements.minLevel > 0 && `Level ${giveaway.requirements.minLevel}+`,
            giveaway.voteBonus > 0 && `+${giveaway.voteBonus} for voting`,
        ].filter(Boolean);

        const actions = {
            running: [actionButton('End now', giveaway, 'end'), actionButton('Cancel', giveaway, 'cancel', true)],
            scheduled: [actionButton('Cancel', giveaway, 'cancel', true)],
            ended: [actionButton('Reroll', giveaway, 'reroll'), actionButton('Delete', giveaway, 'delete', true)],
            cancelled: [actionButton('Delete', giveaway, 'delete', true)],
        }[giveaway.status];

        const winners =
            giveaway.winners.length > 0
                ? `Won by ${giveaway.winners.map((winner) => (winner.name ? `@${winner.name}` : winner.id)).join(', ')}`
                : giveaway.status === 'ended'
                  ? 'No winners'
                  : null;

        return el('article', { className: 'giveaway-row' }, [
            el('div', { className: 'giveaway-main' }, [
                el('div', { className: 'giveaway-title-line' }, [
                    el('span', {
                        className: `case-badge giveaway-${giveaway.status}`,
                        textContent: STATUS_LABELS[giveaway.status],
                    }),
                    giveaway.messageUrl
                        ? el('a', {
                              className: 'giveaway-prize',
                              href: giveaway.messageUrl,
                              target: '_blank',
                              rel: 'noopener',
                              textContent: giveaway.prize,
                          })
                        : el('span', { className: 'giveaway-prize', textContent: giveaway.prize }),
                ]),
                el('p', { className: 'case-meta' }, [
                    el('time', {
                        dateTime: timingDate,
                        title: timingDate ? fullDate.format(new Date(timingDate)) : '',
                        textContent: timing,
                    }),
                    ` · ${channelName(giveaway.channelId)} · ${giveaway.winnerCount} winner${giveaway.winnerCount === 1 ? '' : 's'} · ${giveaway.entrantCount} entered`,
                ]),
                requirements.length > 0 &&
                    el('p', { className: 'case-meta', textContent: `Needs: ${requirements.join(', ')}` }),
                winners && el('p', { className: 'giveaway-winners', textContent: winners }),
            ]),
            el('div', { className: 'giveaway-actions' }, actions),
        ]);
    }

    function renderList() {
        const order = { running: 0, scheduled: 1, ended: 2, cancelled: 3 };
        const sorted = [...giveaways].sort((a, b) => order[a.status] - order[b.status]);
        listHost.replaceChildren(
            card(
                'Giveaways',
                `Ended and cancelled giveaways are kept for ${limits.KEEP_DAYS} days, so they can be rerolled.`,
                [
                    !loaded
                        ? el('p', { className: 'empty-note', textContent: 'Loading…' })
                        : sorted.length === 0
                          ? el('p', { className: 'empty-note', textContent: 'No giveaways yet. Start one above.' })
                          : el('div', { className: 'giveaway-list' }, sorted.map(giveawayRow)),
                ]
            )
        );
    }

    let firstLoad = true;
    async function refresh() {
        const { status, data } = await api(`/api/guilds/${guild.id}/giveaways`);
        if (status !== 200) {
            if (firstLoad) toast(data?.error ?? 'Could not load giveaways.', 'error');
            return;
        }
        giveaways = data.giveaways;
        loaded = true;
        if (firstLoad) {
            firstLoad = false;
            state.replaceSaved(data.settings);
            renderSettings();
        }
        renderList();
    }

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Giveaways' }),
            el('p', {
                className: 'page-subtitle',
                textContent:
                    'Run giveaways with an Enter button. They can also be started with /giveaway start, and members can see running ones with /giveaway list.',
            }),
        ]),
        formHost,
        listHost,
        settingsHost,
        state.bar
    );

    renderForm();
    renderList();
    renderSettings();
    refresh();
    // Keeps entrant counts and end times current while the page is open
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
        clearInterval(timer);
        state.dispose();
    };
}
