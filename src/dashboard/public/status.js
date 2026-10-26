// Status page: whether Ovx is working, shard by shard. Open to everyone.
import { el, api } from './ui.js';

const REFRESH_MS = 30_000;
const OVERALL = {
    operational: ['All systems working', 'status-ok'],
    degraded: ['Some servers may not get responses right now', 'status-warn'],
    down: ['Ovx is having problems', 'status-bad'],
};
const SHARD = {
    online: ['Online', 'status-ok'],
    reconnecting: ['Reconnecting', 'status-warn'],
    down: ['Offline', 'status-bad'],
};
const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

/**
 * @param {HTMLElement} app
 * @returns {() => void} Stops refreshing
 */
export function renderStatus(app) {
    document.title = 'Status · Ovx';
    const body = el('div', {}, [el('p', { className: 'empty-note', textContent: 'Checking…' })]);

    async function refresh() {
        // 503 still has the details: it's how monitors are told something is down
        const { status, data } = await api('/api/public/health');
        if (!data?.shards) {
            body.replaceChildren(
                el('p', {
                    className: 'notice notice-warn',
                    textContent: `Couldn’t check (HTTP ${status}). Try again in a moment.`,
                })
            );
            return;
        }
        const [label, tone] = OVERALL[data.status] ?? OVERALL.down;
        body.replaceChildren(
            el('div', { className: `status-banner ${tone}` }, [el('strong', { textContent: label })]),
            el(
                'ul',
                { className: 'status-list' },
                data.shards.map((shard) => {
                    const [shardLabel, shardTone] = SHARD[shard.status] ?? SHARD.down;
                    return el('li', {}, [
                        el('span', { textContent: `Shard #${shard.id}` }),
                        el('span', {
                            className: `rule-status ${shardTone}`,
                            textContent: shard.ping !== null ? `${shardLabel} · ${shard.ping} ms` : shardLabel,
                        }),
                    ]);
                })
            ),
            el('p', {
                className: 'case-meta',
                textContent: `Checked at ${time.format(new Date(data.checkedAt))}. Updates every 30 seconds.`,
            })
        );
    }

    app.replaceChildren(
        el('article', { className: 'legal' }, [
            el('h1', { className: 'page-title', textContent: 'Status' }),
            el('p', {
                className: 'legal-intro',
                textContent:
                    'Ovx runs in groups of servers called shards. If yours isn’t responding, its shard may be restarting. If this page doesn’t load at all, the whole bot is offline: check our support server for updates.',
            }),
            body,
        ])
    );
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
}
