// Suggestions page: settings, and every suggestion with its votes, to approve, deny or delete.
import { el, api, apiSend, toast } from './ui.js';
import {
    card,
    field,
    toggle,
    channelSelect,
    numberInput,
    chipPicker,
    confirmDialog,
    createSettingsState,
} from './forms.js';

const STATUSES = {
    pending: 'Open for votes',
    considering: 'Being considered',
    approved: 'Approved',
    denied: 'Denied',
    implemented: 'Done',
};
const shortDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderSuggestions(container, overview) {
    const { guild, channels, roles } = overview;
    const limits = overview.limits.SUGGESTIONS;

    let suggestions = [];
    let filter = '';
    let loaded = false;
    /** @type {any} - The settings state, made once the page has loaded */
    let state = null;
    const settingsHost = el('div');
    const listHost = el('div');

    async function load() {
        const query = filter ? `?status=${filter}` : '';
        const { status, data } = await api(`/api/guilds/${guild.id}/suggestions${query}`);
        if (status !== 200) return toast(data?.error ?? 'Could not load suggestions.', 'error');
        suggestions = data.suggestions;
        loaded = true;
        if (!state) {
            state = createSettingsState({
                saved: data.settings,
                onReset: () => renderSettings(),
                async onSave(draft) {
                    const { status: code, data: saved } = await apiSend(
                        'PUT',
                        `/api/guilds/${guild.id}/suggestion-settings`,
                        draft
                    );
                    if (code === 200) {
                        toast('Suggestion settings saved');
                        return { ok: true, saved };
                    }
                    return { ok: false, errors: saved?.details ?? [saved?.error ?? 'Could not save. Try again.'] };
                },
            });
            container.append(state.bar);
            renderSettings();
        }
        renderList();
    }

    function renderSettings() {
        const draft = state.draft;
        const switchField = (key, label, description) =>
            field({
                label,
                description,
                id: `sg-${key}`,
                control: toggle({
                    id: `sg-${key}`,
                    label,
                    checked: draft[key],
                    onChange: (checked) => {
                        draft[key] = checked;
                        state.changed();
                    },
                }),
            });
        settingsHost.replaceChildren(
            card('Settings', 'Members suggest with /suggest. Staff decide with /suggestion or below.', [
                switchField('enabled', 'Suggestions', 'Let members post suggestions. Choose a channel first.'),
                field({
                    label: 'Channel',
                    description: 'Where suggestions are posted. Members don’t need to be able to send messages there.',
                    id: 'sg-channel',
                    control: channelSelect({
                        channels,
                        value: draft.channelId,
                        noneLabel: 'Choose a channel',
                        id: 'sg-channel',
                        onChange: (id) => {
                            draft.channelId = id;
                            state.changed();
                        },
                    }),
                }),
                switchField('threads', 'Discussion threads', 'Open a thread on each suggestion to talk about it.'),
                switchField('dmAuthor', 'Tell the author', 'DM them when their suggestion is decided.'),
                field({
                    label: 'Cooldown',
                    description: 'Time between one member’s suggestions. 0 for none. Managers have no cooldown.',
                    id: 'sg-cooldown',
                    control: numberInput({
                        value: draft.cooldownMinutes,
                        min: 0,
                        max: limits.COOLDOWN_MAX,
                        id: 'sg-cooldown',
                        suffix: 'minutes',
                        onChange: (value) => {
                            draft.cooldownMinutes = value;
                            state.changed();
                        },
                    }),
                }),
                field({
                    label: 'Suggestion managers',
                    description: 'Members with Manage Server can always decide suggestions. These roles can too.',
                    stacked: true,
                    control: chipPicker({
                        options: roles.map((role) => ({ id: role.id, label: `@${role.name}` })),
                        selected: draft.managerRoleIds,
                        placeholder: 'Add a role…',
                        emptyText: 'Only members with Manage Server',
                        onChange: (ids) => {
                            draft.managerRoleIds = ids;
                            state.changed();
                        },
                    }),
                }),
            ])
        );
        state.changed();
    }

    async function decide(suggestion, status, reason) {
        const { status: code, data } = await apiSend(
            'POST',
            `/api/guilds/${guild.id}/suggestions/${suggestion.id}/decide`,
            { status, reason }
        );
        if (code !== 200) return toast(data?.error ?? 'Could not save the decision.', 'error');
        suggestions = suggestions.map((item) => (item.id === data.id ? data : item));
        toast(`#${data.number}: ${STATUSES[data.status]}`);
        renderList();
    }

    async function remove(suggestion) {
        const confirmed = await confirmDialog({
            title: `Delete suggestion #${suggestion.number}?`,
            message: 'Its message (and discussion thread) is deleted from Discord too.',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;
        const { status, data } = await apiSend('DELETE', `/api/guilds/${guild.id}/suggestions/${suggestion.id}`, {});
        if (status !== 200 && status !== 404) return toast(data?.error ?? 'Could not delete it.', 'error');
        suggestions = suggestions.filter((item) => item.id !== suggestion.id);
        toast('Suggestion deleted');
        renderList();
    }

    function row(suggestion) {
        const status = el(
            'select',
            { className: 'select', 'aria-label': `New status for #${suggestion.number}` },
            Object.entries(STATUSES)
                .filter(([value]) => value !== 'pending')
                .map(([value, label]) =>
                    el('option', { value, textContent: label, selected: value === suggestion.status })
                )
        );
        const reason = el('input', {
            className: 'input input-wide',
            type: 'text',
            maxLength: 500,
            placeholder: 'Reason (optional, shown on it)',
            value: suggestion.reason ?? '',
            'aria-label': 'Reason',
        });
        const save = el('button', {
            type: 'button',
            className: 'button button-primary button-small',
            textContent: 'Save decision',
        });
        save.addEventListener('click', () => decide(suggestion, status.value, reason.value));
        const del = el('button', {
            type: 'button',
            className: 'button button-danger-ghost button-small',
            textContent: 'Delete',
        });
        del.addEventListener('click', () => remove(suggestion));

        const votes = `👍 ${suggestion.up} · 👎 ${suggestion.down}${suggestion.approval === null ? '' : ` (${suggestion.approval}%)`}`;
        return el('article', { className: 'giveaway-row' }, [
            el('div', { className: 'giveaway-main' }, [
                el('div', { className: 'giveaway-title-line' }, [
                    el('span', {
                        className: `case-badge suggestion-${suggestion.status}`,
                        textContent: STATUSES[suggestion.status],
                    }),
                    suggestion.messageUrl
                        ? el('a', {
                              className: 'giveaway-prize',
                              href: suggestion.messageUrl,
                              target: '_blank',
                              rel: 'noopener',
                              textContent: `#${suggestion.number}`,
                          })
                        : el('span', { className: 'giveaway-prize', textContent: `#${suggestion.number}` }),
                ]),
                el('p', { className: 'case-reason', textContent: suggestion.content }),
                el('p', {
                    className: 'case-meta',
                    textContent: `${suggestion.author?.name ? `@${suggestion.author.name}` : 'A former member'} · ${shortDate.format(new Date(suggestion.createdAt))} · ${votes}`,
                }),
                suggestion.reason && el('p', { className: 'case-meta', textContent: `Reason: ${suggestion.reason}` }),
                el('details', { className: 'type-details' }, [
                    el('summary', { textContent: 'Decide' }),
                    el('div', { className: 'inline-controls' }, [status, reason, save]),
                ]),
            ]),
            el('div', { className: 'giveaway-actions' }, [del]),
        ]);
    }

    function renderList() {
        const filterSelect = el('select', { className: 'select', 'aria-label': 'Show' }, [
            el('option', { value: '', textContent: 'All suggestions' }),
            ...Object.entries(STATUSES).map(([value, label]) =>
                el('option', { value, textContent: label, selected: value === filter })
            ),
        ]);
        filterSelect.addEventListener('change', () => {
            filter = filterSelect.value;
            load();
        });
        listHost.replaceChildren(
            card('Suggestions', 'Newest first. Members vote with the buttons on each one.', [
                el('div', { className: 'card-actions' }, [filterSelect]),
                !loaded
                    ? el('p', { className: 'empty-note', textContent: 'Loading…' })
                    : suggestions.length === 0
                      ? el('p', {
                            className: 'empty-note',
                            textContent: filter ? 'None with that status.' : 'No suggestions yet.',
                        })
                      : el('div', { className: 'giveaway-list' }, suggestions.map(row)),
            ])
        );
    }

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Suggestions' }),
            el('p', {
                className: 'page-subtitle',
                textContent: 'Members share ideas with /suggest and everyone votes on them.',
            }),
        ]),
        settingsHost,
        listHost
    );
    renderList();
    load();
    return () => state?.dispose();
}
