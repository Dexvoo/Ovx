// Docs page: how to get started, and every command, built from the bot's own command list.
import { el, api } from './ui.js';

const SUPPORT_URL = 'https://discord.gg/t7tF2Qs3Qc';

/** The command reference, fetched once per visit */
let cached = null;

/**
 * @param {HTMLElement} app
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderDocs(app) {
    document.title = 'Docs · Ovx';
    let left = false;

    const body = el('div', { className: 'docs-body' }, [
        el('p', { className: 'empty', textContent: 'Loading commands…' }),
    ]);
    app.replaceChildren(
        el('article', { className: 'docs' }, [
            el('h1', { className: 'page-title', textContent: 'Docs' }),
            el('p', {
                className: 'docs-lead',
                textContent: 'How to set up Ovx, and what every command does.',
            }),
            gettingStarted(),
            body,
        ])
    );

    load().then((docs) => {
        if (left) return;
        if (!docs) {
            body.replaceChildren(
                el('p', {
                    className: 'empty',
                    textContent: 'The command list could not be loaded. Try again in a moment.',
                })
            );
            return;
        }
        body.replaceChildren(...reference(docs));
        // Opened from a link to one section, e.g. /docs#levels
        if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    });

    if (!location.hash) scrollTo(0, 0);
    return () => {
        left = true;
    };
}

async function load() {
    if (cached) return cached;
    const { status, data } = await api('/api/public/docs').catch(() => ({ status: 0, data: null }));
    if (status !== 200) return null;
    cached = data;
    return cached;
}

function gettingStarted() {
    const steps = [
        ['Add Ovx to your server', 'Log in on this site and pick a server, or use the invite link in Discord.'],
        [
            'Set it up on the dashboard',
            'Every feature is switched on and changed here. Only the owner and people with Manage Server can change settings.',
        ],
        ['Use the commands', 'Type / in Discord to see them, or use /help for a guide inside Discord.'],
    ];
    return el('section', { className: 'docs-start' }, [
        el('h2', { textContent: 'Getting started' }),
        el(
            'ol',
            { className: 'docs-steps' },
            steps.map(([title, text]) =>
                el('li', {}, [el('strong', { textContent: title }), el('span', { textContent: text })])
            )
        ),
        el('div', { className: 'docs-actions' }, [
            el('a', { className: 'button button-primary', href: '/servers', textContent: 'Open the dashboard' }),
            el('a', {
                className: 'button button-ghost',
                href: SUPPORT_URL,
                target: '_blank',
                rel: 'noopener',
                textContent: 'Ask in the support server',
            }),
        ]),
    ]);
}

/** Search, the category list and each category's commands. */
function reference(docs) {
    const sections = docs.categories.map((category) => categorySection(category));
    const noMatches = el('p', { className: 'empty', textContent: 'No commands match that search.', hidden: true });

    const search = el('input', {
        className: 'input docs-search',
        type: 'search',
        placeholder: 'Search commands',
        'aria-label': 'Search commands',
    });
    search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase().replace(/^\//, '');
        let shown = 0;
        for (const section of sections) {
            let inSection = 0;
            for (const card of section.querySelectorAll('.docs-command')) {
                const match = !query || card.dataset.search.includes(query);
                card.hidden = !match;
                if (match) inSection++;
            }
            section.hidden = inSection === 0;
            shown += inSection;
        }
        noMatches.hidden = shown > 0;
    });

    return [
        el('h2', { className: 'docs-heading', textContent: 'Commands' }),
        el('nav', { className: 'docs-toc', 'aria-label': 'Command categories' }, [
            ...docs.categories.map((category) =>
                el('a', {
                    className: 'docs-chip',
                    href: `#${category.id}`,
                    textContent: `${category.emoji} ${category.name}`,
                })
            ),
            el('a', { className: 'docs-chip', href: '#dashboard', textContent: '⚙️ On the dashboard' }),
        ]),
        search,
        noMatches,
        ...sections,
        el('section', { className: 'docs-category', id: 'dashboard' }, [
            el('h2', { textContent: '⚙️ On the dashboard' }),
            el('p', {
                className: 'docs-category-text',
                textContent: 'These features have no commands: they are set up on the dashboard.',
            }),
            el(
                'ul',
                { className: 'docs-features' },
                docs.dashboardFeatures.map((name) => el('li', { textContent: name }))
            ),
        ]),
    ];
}

function categorySection(category) {
    return el('section', { className: 'docs-category', id: category.id }, [
        el('h2', { textContent: `${category.emoji} ${category.name}` }),
        el('p', { className: 'docs-category-text', textContent: category.long }),
        ...category.commands.map(commandCard),
    ]);
}

function commandCard(command) {
    const words = [
        command.name,
        command.description,
        ...command.entries.flatMap((entry) => [entry.path, entry.description]),
    ];

    const where = [command.servers && 'Servers', command.dms && 'DMs'].filter(Boolean).join(', ') || '-';
    const meta = el('dl', { className: 'docs-meta' }, [
        el('dt', { textContent: 'Who' }),
        el('dd', {
            textContent: command.permissions.length > 0 ? `Members with ${command.permissions.join(', ')}` : 'Everyone',
        }),
        el('dt', { textContent: 'Where' }),
        el('dd', { textContent: where }),
        command.cooldown > 0 && el('dt', { textContent: 'Cooldown' }),
        command.cooldown > 0 && el('dd', { textContent: `${command.cooldown}s` }),
    ]);

    if (command.menu) {
        return el('div', { className: 'docs-command', dataset: { search: words.join(' ').toLowerCase() } }, [
            el('h3', {}, [el('code', { textContent: command.name })]),
            el('p', { textContent: `A right-click menu: right-click ${command.menu}, then Apps.` }),
            meta,
        ]);
    }

    // One subcommand-less command shows its description once, not twice
    const single = command.entries.length === 1 && command.entries[0].path === command.name;
    return el('div', { className: 'docs-command', dataset: { search: words.join(' ').toLowerCase() } }, [
        el('h3', {}, [el('code', { textContent: `/${command.name}` })]),
        el('p', { textContent: command.description }),
        !(single && command.entries[0].options.length === 0) &&
            el(
                'ul',
                { className: 'docs-entries' },
                command.entries.map((entry) =>
                    el('li', {}, [
                        !single && el('code', { className: 'docs-path', textContent: `/${entry.path}` }),
                        !single && el('span', { textContent: entry.description }),
                        entry.options.length > 0 &&
                            el(
                                'ul',
                                { className: 'docs-options' },
                                entry.options.map((option) =>
                                    el('li', {}, [
                                        el('code', { textContent: option.name }),
                                        option.required &&
                                            el('span', { className: 'docs-required', textContent: 'required' }),
                                        el('span', { textContent: option.description }),
                                    ])
                                )
                            ),
                    ])
                )
            ),
        meta,
    ]);
}
