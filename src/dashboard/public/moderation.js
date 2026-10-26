// Moderation page: automatic actions after a number of warnings, and every case (warning, mute, kick, ban),
// newest first, with search and delete.
import { el, api, apiSend, toast } from './ui.js';
import { card, confirmDialog, createSettingsState, resetCard } from './forms.js';

const SEARCH_DELAY_MS = 300;

const AUTO_ACTIONS = { mute: 'Mute for', kick: 'Kick', ban: 'Ban' };
const MINUTE = 60_000;
const MUTE_PRESETS = [10, 60, 360, 720, 1440, 4320, 10_080, 40_320].map((minutes) => minutes * MINUTE);
const DEFAULT_MUTE_MS = 60 * MINUTE;

const ACTIONS = {
    warn: 'Warning',
    mute: 'Mute',
    unmute: 'Unmute',
    kick: 'Kick',
    ban: 'Ban',
    unban: 'Unban',
    note: 'Note',
};

const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const shortDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** "1 hour 30 minutes" from milliseconds: the two largest units. */
function formatDuration(ms) {
    /** @type {[string, number][]} */
    const units = [
        ['week', 604_800_000],
        ['day', 86_400_000],
        ['hour', 3_600_000],
        ['minute', 60_000],
        ['second', 1000],
    ];
    const parts = [];
    let rest = ms;
    for (const [name, size] of units) {
        const count = Math.floor(rest / size);
        if (!count) continue;
        parts.push(`${count} ${name}${count === 1 ? '' : 's'}`);
        rest -= count * size;
        if (parts.length === 2) break;
    }
    return parts.join(' ');
}

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderModeration(container, overview) {
    const { guild } = overview;

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let searchTimer;
    let requestId = 0;
    let nextCursor = null;

    const memberSearch = el('input', {
        className: 'search search-column',
        type: 'search',
        placeholder: 'Name or user ID',
        'aria-label': 'Search members by name or user ID',
    });
    const actionFilter = el('select', { className: 'select search-column', 'aria-label': 'Filter by action' }, [
        el('option', { value: '', textContent: 'All actions' }),
        ...Object.entries(ACTIONS).map(([value, label]) => el('option', { value, textContent: label })),
    ]);

    const body = el('tbody');
    const status = el('p', { className: 'audit-status' });
    const loadMore = el('button', {
        type: 'button',
        className: 'button button-ghost',
        textContent: 'Load more',
        hidden: true,
    });

    const table = el('table', { className: 'audit-table cases-table' }, [
        el('thead', {}, [
            el('tr', {}, [
                el('th', { scope: 'col', className: 'col-executed', textContent: 'Case' }),
                el('th', { scope: 'col', className: 'col-user' }, [
                    el('span', { textContent: 'Member' }),
                    memberSearch,
                ]),
                el('th', { scope: 'col', className: 'col-action' }, [
                    el('span', { textContent: 'Action' }),
                    actionFilter,
                ]),
            ]),
        ]),
        body,
    ]);

    async function remove(entry, rowElement, button) {
        const confirmed = await confirmDialog({
            title: `Delete case #${entry.number}?`,
            message: `The ${ACTIONS[entry.action].toLowerCase()} for @${entry.username} will be removed from their record. This only deletes the record: it doesn't undo a ban or mute in Discord.`,
            confirmLabel: 'Delete case',
        });
        if (!confirmed) return;

        button.disabled = true;
        const { status: code, data } = await apiSend('DELETE', `/api/guilds/${guild.id}/cases/${entry.number}`, {});
        if (code === 200 || code === 404) {
            rowElement.remove();
            toast(code === 200 ? `Case #${entry.number} deleted` : 'That case was already deleted');
            if (body.children.length === 0) load(false);
            return;
        }
        button.disabled = false;
        toast(data?.error ?? 'Could not delete the case. Try again.', 'error');
    }

    function row(entry) {
        const date = new Date(entry.createdAt);
        const deleteButton = el('button', {
            type: 'button',
            className: 'button button-danger-ghost button-small case-delete',
            textContent: 'Delete',
            'aria-label': `Delete case #${entry.number}`,
        });

        const rowElement = el('tr', {}, [
            el('td', { className: 'col-executed', dataset: { label: 'Case' } }, [
                el('div', { className: 'case-number', textContent: `#${entry.number}` }),
                el('time', {
                    dateTime: date.toISOString(),
                    title: fullDate.format(date),
                    textContent: shortDate.format(date),
                }),
            ]),
            el('td', { className: 'col-user', dataset: { label: 'Member' } }, [
                el('div', { className: 'audit-name', textContent: `@${entry.username}` }),
                el('div', { className: 'audit-username', textContent: entry.userId }),
            ]),
            el('td', { className: 'col-action', dataset: { label: 'Action' } }, [
                el('div', { className: 'audit-action-line' }, [
                    el('span', {
                        className: `case-badge case-${entry.action}`,
                        textContent: ACTIONS[entry.action] ?? entry.action,
                    }),
                    entry.durationMs &&
                        el('span', { className: 'case-meta', textContent: formatDuration(entry.durationMs) }),
                    deleteButton,
                ]),
                el('p', { className: 'case-reason', textContent: entry.reason ?? 'No reason given' }),
                el('p', {
                    className: 'case-meta',
                    textContent: `${entry.moderatorName ? `By @${entry.moderatorName}` : 'Moderator unknown'}${
                        entry.source === 'discord' ? ' · done in Discord' : ''
                    }`,
                }),
            ]),
        ]);
        deleteButton.addEventListener('click', () => remove(entry, rowElement, deleteButton));
        return rowElement;
    }

    /** @param {boolean} append - true for "Load more", false for a new search */
    async function load(append) {
        const id = ++requestId;
        const params = new URLSearchParams();
        if (memberSearch.value.trim()) params.set('member', memberSearch.value.trim());
        if (actionFilter.value) params.set('action', actionFilter.value);
        if (append && nextCursor) params.set('before', String(nextCursor));

        loadMore.disabled = true;
        if (!append) status.textContent = 'Loading…';

        const { status: code, data } = await api(`/api/guilds/${guild.id}/cases?${params}`);
        if (id !== requestId) return; // A newer search started while this one was loading

        loadMore.disabled = false;
        if (code !== 200) {
            status.textContent = data?.error ?? 'Could not load the cases.';
            return;
        }

        const rows = data.cases.map(row);
        if (append) body.append(...rows);
        else body.replaceChildren(...rows);
        nextCursor = data.nextCursor;
        loadMore.hidden = !nextCursor;

        const searching = Boolean(memberSearch.value.trim() || actionFilter.value);
        status.textContent =
            body.children.length > 0
                ? ''
                : searching
                  ? 'No cases match your search.'
                  : 'No cases yet. Warnings, mutes, kicks and bans will show up here.';
    }

    memberSearch.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => load(false), SEARCH_DELAY_MS);
    });
    actionFilter.addEventListener('change', () => load(false));
    loadMore.addEventListener('click', () => load(true));

    // ---------- Automatic actions ----------

    const limits = overview.limits.WARN_ACTIONS;
    const settingsHost = el('div');
    const state = createSettingsState({
        saved: overview.moderation,
        onReset: () => renderSettings(),
        async onSave(draft) {
            const { status: code, data } = await apiSend('PUT', `/api/guilds/${guild.id}/moderation`, draft);
            if (code === 200) {
                overview.moderation = data;
                toast('Automatic actions saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status: code, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/moderation`, {});
        if (code !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.moderation = data;
        state.replaceSaved(data);
        renderSettings();
        toast('Automatic actions removed');
        return true;
    }

    /** Mute lengths offered, plus the saved one if it isn't among them. */
    function durationOptions(current) {
        const values = MUTE_PRESETS.includes(current) || !current ? MUTE_PRESETS : [...MUTE_PRESETS, current];
        return [...values]
            .sort((a, b) => a - b)
            .map((ms) =>
                el('option', { value: String(ms), textContent: formatDuration(ms), selected: ms === current })
            );
    }

    function ruleRow(rule, index) {
        const id = `warn-rule-${index}`;
        const count = el('input', {
            id,
            className: 'input rule-count',
            type: 'number',
            min: 1,
            max: limits.WARNINGS,
            value: String(rule.warnings),
            'aria-label': 'Number of warnings',
        });
        count.addEventListener('input', () => {
            rule.warnings = Number(count.value);
            state.changed();
        });

        const action = el(
            'select',
            { className: 'select', 'aria-label': 'What happens' },
            Object.entries(AUTO_ACTIONS).map(([value, label]) =>
                el('option', { value, textContent: label, selected: value === rule.action })
            )
        );
        action.addEventListener('change', () => {
            rule.action = action.value;
            rule.durationMs = rule.action === 'mute' ? (rule.durationMs ?? DEFAULT_MUTE_MS) : null;
            state.changed();
            renderSettings();
        });

        const duration =
            rule.action === 'mute' &&
            el('select', { className: 'select', 'aria-label': 'Mute length' }, durationOptions(rule.durationMs));
        if (duration) {
            duration.addEventListener('change', () => {
                rule.durationMs = Number(duration.value);
                state.changed();
            });
        }

        const remove = el('button', {
            type: 'button',
            className: 'button button-ghost button-small',
            textContent: 'Remove',
            'aria-label': `Remove the action at ${rule.warnings} warnings`,
        });
        remove.addEventListener('click', () => {
            state.draft.warnActions.splice(index, 1);
            state.changed();
            renderSettings();
        });

        return el('div', { className: 'rule-row' }, [
            el('label', { className: 'rule-text', for: id, textContent: 'At' }),
            count,
            el('span', { className: 'rule-text', textContent: 'warnings:' }),
            action,
            duration,
            remove,
        ]);
    }

    function addRule() {
        const rules = state.draft.warnActions;
        const next = rules.length ? Math.max(...rules.map((rule) => rule.warnings)) + 1 : 3;
        rules.push({ warnings: Math.min(next, limits.WARNINGS), action: 'mute', durationMs: DEFAULT_MUTE_MS });
        state.changed();
        renderSettings();
        /** @type {HTMLInputElement | null} */ (
            settingsHost.querySelector('.rule-row:last-child .rule-count')
        )?.focus();
    }

    function renderSettings() {
        const rules = state.draft.warnActions;
        const addButton = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: '+ Add automatic action',
            disabled: rules.length >= limits.RULES,
        });
        addButton.addEventListener('click', addRule);

        settingsHost.replaceChildren(
            card(
                'Automatic actions',
                'When a warning brings someone to exactly this many warnings, Ovx mutes, kicks or bans them. It needs that permission and a role above theirs.',
                [
                    rules.length === 0 &&
                        el('p', {
                            className: 'empty-note',
                            textContent: 'No automatic actions. Warnings only go on the record.',
                        }),
                    el('div', { className: 'rule-list' }, rules.map(ruleRow)),
                    el('div', { className: 'card-actions' }, [addButton]),
                ]
            )
        );
        state.changed();
    }

    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Moderation' }),
            el('p', {
                className: 'page-subtitle',
                textContent:
                    'Every warning, mute, kick and ban, whether it was done with /moderation or in Discord itself. Use /moderation history in Discord to check someone quickly.',
            }),
        ]),
        settingsHost,
        el('section', { className: 'card audit-card' }, [
            el('div', { className: 'audit-scroll' }, [table]),
            status,
            el('div', { className: 'audit-more' }, [loadMore]),
        ]),
        resetCard({
            description: 'Removes every automatic action. Members’ cases are kept.',
            confirmMessage:
                'Every automatic action will be removed. Cases and warnings are not affected. This cannot be undone.',
            onReset: resetToDefaults,
        }),
        state.bar
    );

    renderSettings();
    load(false);
    return () => {
        clearTimeout(searchTimer);
        state.dispose();
    };
}
