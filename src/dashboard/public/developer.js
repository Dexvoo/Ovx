// Developer page (/dev): shards, and which commands and features servers use. Only for DEVELOPER_IDS; the API
// answers 404 to everyone else.
import { el, api } from './ui.js';
import { card } from './forms.js';

const WINDOWS = [7, 30, 90];
const COMMANDS_SHOWN = 20;
const number = new Intl.NumberFormat();
const shortDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "3d 4h" from milliseconds. */
function uptime(ms) {
    const minutes = Math.floor(ms / 60_000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

/** A row with a label, a bar sized against the largest, and the number. */
function barRow(label, value, max, detail) {
    const bar = el('span', { className: 'usage-bar-fill' });
    bar.style.width = `${max ? Math.max(1, (value / max) * 100) : 0}%`;
    return el('div', { className: 'usage-bar-row' }, [
        el('span', { className: 'usage-bar-label', textContent: label, title: label }),
        el('span', { className: 'usage-bar' }, [bar]),
        el('span', { className: 'usage-bar-value', textContent: detail ?? number.format(value) }),
    ]);
}

function tile(label, value, note) {
    return el(
        'div',
        { className: 'usage-tile' },
        [
            el('span', { className: 'usage-tile-value', textContent: value }),
            el('span', { className: 'usage-tile-label', textContent: label }),
            note && el('span', { className: 'usage-tile-note', textContent: note }),
        ].filter(Boolean)
    );
}

/**
 * @param {HTMLElement} container
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderDeveloper(container) {
    let days = 30;
    let showAllCommands = false;
    let usage = null;
    let shards = null;
    let failed = false;
    const body = el('div');

    async function load() {
        usage = null;
        render();
        const [usageResult, shardResult] = await Promise.all([
            api(`/api/dev/usage?days=${days}`),
            shards ? Promise.resolve(null) : api('/api/dev/stats'),
        ]);
        if (shardResult?.status === 200) shards = shardResult.data;
        if (usageResult.status === 404 || shardResult?.status === 404) failed = true;
        else if (usageResult.status === 200) usage = usageResult.data;
        render();
    }

    function shardCard() {
        if (!shards) return card('Shards', null, [el('p', { className: 'empty-note', textContent: 'Loading…' })]);
        const { totals, manager } = shards;
        const rows = shards.shards
            .sort((a, b) => a.shardId - b.shardId)
            .map((shard) =>
                el('tr', {}, [
                    el('td', { textContent: `#${shard.shardId}` }),
                    el('td', { textContent: shard.status === 0 ? 'Ready' : `Status ${shard.status}` }),
                    el('td', { textContent: `${shard.ping} ms` }),
                    el('td', { textContent: number.format(shard.guilds) }),
                    el('td', { textContent: number.format(shard.members) }),
                    el('td', { textContent: `${shard.memoryMb} MB` }),
                    el('td', { textContent: uptime(shard.uptimeMs) }),
                ])
            );
        return card(
            'Shards',
            `${number.format(totals.guilds)} servers · ${number.format(totals.members)} members · dashboard up ${uptime(manager.uptimeMs)}, ${manager.memoryMb} MB, Node ${manager.nodeVersion}`,
            [
                el('div', { className: 'audit-scroll' }, [
                    el('table', { className: 'audit-table' }, [
                        el('thead', {}, [
                            el(
                                'tr',
                                {},
                                ['Shard', 'Status', 'Ping', 'Servers', 'Members', 'Memory', 'Up'].map((text) =>
                                    el('th', { scope: 'col', textContent: text })
                                )
                            ),
                        ]),
                        el('tbody', {}, rows),
                    ]),
                ]),
            ]
        );
    }

    function dailyChart() {
        const max = Math.max(...usage.daily.map((day) => day.uses), 1);
        const bars = usage.daily.map((day) => {
            const bar = el('span', { className: 'usage-column-fill' });
            bar.style.height = `${(day.uses / max) * 100}%`;
            const date = new Date(`${day.day}T00:00:00Z`);
            return el(
                'span',
                {
                    className: 'usage-column',
                    title: `${shortDay.format(date)}: ${number.format(day.uses)} commands in ${number.format(day.servers)} servers · +${day.joins} / −${day.leaves} servers`,
                },
                [bar]
            );
        });
        const first = new Date(`${usage.daily[0].day}T00:00:00Z`);
        const last = new Date(`${usage.daily[usage.daily.length - 1].day}T00:00:00Z`);
        return card('Commands per day', 'Hover a day for its numbers. Days are in UTC.', [
            el('div', { className: 'usage-columns', role: 'img', 'aria-label': 'Commands used each day' }, bars),
            el('div', { className: 'usage-columns-axis' }, [
                el('span', { textContent: shortDay.format(first) }),
                el('span', { textContent: shortDay.format(last) }),
            ]),
        ]);
    }

    function commandsCard() {
        const list = showAllCommands ? usage.commands : usage.commands.slice(0, COMMANDS_SHOWN);
        const max = usage.commands[0]?.uses ?? 0;
        const toggle =
            usage.commands.length > COMMANDS_SHOWN &&
            el('button', {
                type: 'button',
                className: 'button button-ghost button-small',
                textContent: showAllCommands ? 'Show fewer' : `Show all ${usage.commands.length}`,
            });
        toggle?.addEventListener('click', () => {
            showAllCommands = !showAllCommands;
            render();
        });
        return card(
            'Commands',
            'How often each command (and subcommand) was used.',
            [
                list.length === 0
                    ? el('p', { className: 'empty-note', textContent: 'No commands used yet in this period.' })
                    : el(
                          'div',
                          { className: 'usage-bars' },
                          list.map((command) => barRow(`/${command.name}`, command.uses, max))
                      ),
                toggle && el('div', { className: 'card-actions' }, [toggle]),
            ].filter(Boolean)
        );
    }

    function featuresCard() {
        const total = usage.serverCount;
        const max = total ?? Math.max(...usage.features.map((feature) => feature.servers), 1);
        return card('Features', 'Servers with each feature switched on or set up, right now.', [
            el(
                'div',
                { className: 'usage-bars' },
                usage.features.map((feature) =>
                    barRow(
                        feature.label,
                        feature.servers,
                        max,
                        total
                            ? `${number.format(feature.servers)} · ${Math.round((feature.servers / total) * 100)}%`
                            : undefined
                    )
                )
            ),
        ]);
    }

    function disabledCard() {
        const max = usage.disabledCommands[0]?.servers ?? 0;
        return card(
            'Commands servers turn off',
            'From the Commands page. Often a sign a command clashes with another bot.',
            [
                usage.disabledCommands.length === 0
                    ? el('p', { className: 'empty-note', textContent: 'No server has turned a command off.' })
                    : el(
                          'div',
                          { className: 'usage-bars' },
                          usage.disabledCommands.map((command) =>
                              barRow(
                                  `/${command.name}`,
                                  command.servers,
                                  max,
                                  `${number.format(command.servers)} servers`
                              )
                          )
                      ),
            ]
        );
    }

    function render() {
        if (failed) {
            body.replaceChildren(
                el('p', { className: 'empty', textContent: 'This page is only for Ovx’s developers.' })
            );
            return;
        }
        const tabs = el(
            'div',
            { className: 'usage-tabs', role: 'group', 'aria-label': 'Period' },
            WINDOWS.map((window) => {
                const tab = el('button', {
                    type: 'button',
                    className: `button button-small ${window === days ? 'button-primary' : 'button-ghost'}`,
                    textContent: `${window} days`,
                    'aria-pressed': String(window === days),
                });
                tab.addEventListener('click', () => {
                    if (window === days) return;
                    days = window;
                    load();
                });
                return tab;
            })
        );

        const sections = [shardCard(), tabs];
        if (!usage) sections.push(el('p', { className: 'empty-note', textContent: 'Loading usage…' }));
        else {
            const { totals } = usage;
            const net = totals.joins - totals.leaves;
            sections.push(
                el('div', { className: 'usage-tiles' }, [
                    tile('Commands used', number.format(totals.uses)),
                    tile(
                        'Servers using commands',
                        number.format(totals.activeServers),
                        usage.serverCount ? `of ${number.format(usage.serverCount)}` : null
                    ),
                    tile('Servers added', `+${number.format(totals.joins)}`),
                    tile(
                        'Servers removed',
                        `−${number.format(totals.leaves)}`,
                        `net ${net >= 0 ? '+' : '−'}${number.format(Math.abs(net))}`
                    ),
                ]),
                dailyChart(),
                commandsCard(),
                featuresCard(),
                disabledCard()
            );
        }
        body.replaceChildren(...sections);
    }

    document.title = 'Developer · Ovx Dashboard';
    container.replaceChildren(
        el('div', { className: 'section-header' }, [
            el('h1', { className: 'page-title', textContent: 'Developer' }),
            el('p', {
                className: 'page-subtitle',
                textContent: 'How Ovx is doing, and what servers use. Usage counting started with this update.',
            }),
        ]),
        body
    );
    load();
    return () => {};
}
