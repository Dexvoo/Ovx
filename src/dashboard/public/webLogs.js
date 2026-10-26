// Web Logs: settings changes made on the dashboard, newest first, searchable by username and action.
import { el, api } from './ui.js';

const SEARCH_DELAY_MS = 300;
// New entries (e.g. from another manager) show up without reloading the page
const AUTO_REFRESH_MS = 30_000;
const RETENTION_DAYS = 90;

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "just now", "5 minutes ago", "yesterday"… */
function timeAgo(date) {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    /** @type {[Intl.RelativeTimeFormatUnit, number][]} */
    const units = [
        ['year', 31536000],
        ['month', 2592000],
        ['week', 604800],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
    }
    return 'just now';
}

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderWebLogs(container, overview) {
    const { guild } = overview;

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let searchTimer;
    let requestId = 0;
    let nextCursor = null;
    let pagesLoaded = 0;

    const usernameSearch = el('input', {
        className: 'search search-column',
        type: 'search',
        placeholder: 'Search usernames',
        'aria-label': 'Search usernames',
    });
    const actionSearch = el('input', {
        className: 'search search-column',
        type: 'search',
        placeholder: 'Search actions',
        'aria-label': 'Search actions',
    });

    const refreshButton = el('button', {
        type: 'button',
        className: 'button button-ghost',
        textContent: 'Refresh',
    });

    const body = el('tbody');
    const status = el('p', { className: 'audit-status' });
    const loadMore = el('button', {
        type: 'button',
        className: 'button button-ghost',
        textContent: 'Load more',
        hidden: true,
    });

    const table = el('table', { className: 'audit-table' }, [
        el('thead', {}, [
            el('tr', {}, [
                el('th', { scope: 'col', className: 'col-executed', textContent: 'Executed' }),
                el('th', { scope: 'col', className: 'col-user' }, [
                    el('span', { textContent: 'Username' }),
                    usernameSearch,
                ]),
                el('th', { scope: 'col', className: 'col-action' }, [
                    el('span', { textContent: 'Action' }),
                    actionSearch,
                ]),
            ]),
        ]),
        body,
    ]);

    function row(entry) {
        const date = new Date(entry.createdAt);
        return el('tr', {}, [
            el('td', { className: 'col-executed', dataset: { label: 'Executed' } }, [
                el('time', { dateTime: date.toISOString(), title: fullDate.format(date), textContent: timeAgo(date) }),
            ]),
            el('td', { className: 'col-user', dataset: { label: 'Username' } }, [
                el('div', { className: 'audit-user' }, [
                    entry.avatar
                        ? el('img', {
                              className: 'audit-avatar',
                              src: entry.avatar,
                              alt: '',
                              width: 28,
                              height: 28,
                              loading: 'lazy',
                          })
                        : el('span', { className: 'audit-avatar', 'aria-hidden': 'true' }),
                    el('div', {}, [
                        el('div', { className: 'audit-name', textContent: entry.displayName }),
                        el('div', { className: 'audit-username', textContent: `@${entry.username}` }),
                    ]),
                ]),
            ]),
            el('td', { className: 'col-action', dataset: { label: 'Action' } }, [
                el('div', { className: 'audit-action-line' }, [
                    el('span', { className: 'audit-action', textContent: entry.action }),
                    el('span', {
                        className: entry.source === 'Dashboard' ? 'audit-source' : 'audit-source audit-source-command',
                        textContent: entry.source,
                        title:
                            entry.source === 'Dashboard' ? 'Changed on this dashboard' : 'Changed with a slash command',
                    }),
                ]),
                entry.changes.length > 0 &&
                    el(
                        'ul',
                        { className: 'audit-changes' },
                        entry.changes.map((change) => el('li', { textContent: change }))
                    ),
            ]),
        ]);
    }

    /**
     * @param {boolean} append - true for "Load more", false for a new search or refresh
     * @param {{ quiet?: boolean }} [options] - quiet: refresh in place without showing "Loading…"
     */
    async function load(append, { quiet = false } = {}) {
        const id = ++requestId;
        const params = new URLSearchParams();
        if (usernameSearch.value.trim()) params.set('username', usernameSearch.value.trim());
        if (actionSearch.value.trim()) params.set('action', actionSearch.value.trim());
        if (append && nextCursor) params.set('before', nextCursor);

        loadMore.disabled = true;
        if (!append && !quiet) status.textContent = 'Loading…';

        const { status: code, data } = await api(`/api/guilds/${guild.id}/audit-log?${params}`);
        if (id !== requestId) return; // A newer search started while this one was loading

        loadMore.disabled = false;
        if (code !== 200) {
            status.textContent = data?.error ?? 'Could not load the Web Logs.';
            return;
        }

        const rows = data.entries.map(row);
        if (append) body.append(...rows);
        else body.replaceChildren(...rows);

        pagesLoaded = append ? pagesLoaded + 1 : 1;
        nextCursor = data.nextCursor;
        loadMore.hidden = !nextCursor;

        const searching = Boolean(usernameSearch.value.trim() || actionSearch.value.trim());
        status.textContent =
            body.children.length > 0
                ? ''
                : searching
                  ? 'No entries match your search.'
                  : 'No changes yet. Settings changed here will show up here.';
    }

    const onSearch = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => load(false), SEARCH_DELAY_MS);
    };
    usernameSearch.addEventListener('input', onSearch);
    actionSearch.addEventListener('input', onSearch);
    loadMore.addEventListener('click', () => load(true));
    refreshButton.addEventListener('click', () => load(false));

    // Only refresh automatically while showing the first page, so older entries someone is reading don't vanish
    const autoRefresh = () => {
        if (document.visibilityState === 'visible' && pagesLoaded === 1) load(false, { quiet: true });
    };
    const refreshTimer = setInterval(autoRefresh, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', autoRefresh);

    container.replaceChildren(
        el('div', { className: 'section-header section-header-actions' }, [
            el('div', {}, [
                el('h1', { className: 'page-title', textContent: 'Web Logs' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent: `Changes made to Ovx’s settings on this dashboard. Entries are kept for ${RETENTION_DAYS} days.`,
                }),
            ]),
            refreshButton,
        ]),
        el('section', { className: 'card audit-card' }, [
            el('div', { className: 'audit-scroll' }, [table]),
            status,
            el('div', { className: 'audit-more' }, [loadMore]),
        ])
    );

    load(false);
    return () => {
        clearTimeout(searchTimer);
        clearInterval(refreshTimer);
        document.removeEventListener('visibilitychange', autoRefresh);
    };
}
