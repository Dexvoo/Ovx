// Public pages: the landing page (what logged-out visitors see at /) and the legal pages.
import { el, staticSvg } from './ui.js';
import { LEGAL_PAGES, CONTACT_EMAIL } from './legal.js';

export const SUPPORT_URL = 'https://discord.gg/t7tF2Qs3Qc';

const icon = (paths) =>
    staticSvg(
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
    );

const FEATURES = [
    {
        title: 'Levels & rewards',
        text: 'XP for chatting and voice, leaderboards, level-up messages and roles handed out automatically.',
        icon: '<path d="M5 20v-6M12 20V9M19 20V4"/>',
    },
    {
        title: 'Server logs',
        text: 'Messages, members, roles, channels, voice, bans and server changes, each to its own channel.',
        icon: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    },
    {
        title: 'Tickets',
        text: 'Your own ticket buttons, each with its own staff, permissions and message. Transcripts included.',
        icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M15 6v12" stroke-dasharray="2 2.5"/>',
    },
    {
        title: 'Welcome & goodbye',
        text: 'Greet new members and say goodbye with your own message, as text or an embed.',
        icon: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
    },
    {
        title: 'Auto roles',
        text: 'Give roles to new members and bots the moment they join, after membership screening.',
        icon: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    },
    {
        title: 'Stream alerts',
        text: 'Announce when your favourite creators go live on Twitch, Kick or YouTube, or post a new video.',
        icon: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
    },
    {
        title: 'Make it yours',
        text: 'Give Ovx its own nickname, avatar, banner, bio and embed colour in each of your servers.',
        icon: '<path d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1a1.6 1.6 0 0 1 1.2-2.6H16a5 5 0 0 0 5-5c0-4.3-4-7.8-9-7.8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    },
    {
        title: 'Web logs',
        text: 'See who changed which setting and when, so nothing changes without you knowing.',
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    },
];

const STEPS = [
    { title: 'Add Ovx', text: 'Invite the bot to your server. It only asks for the permissions its features use.' },
    { title: 'Log in', text: 'Sign in with Discord and pick a server you manage.' },
    { title: 'Switch things on', text: 'Turn on the features you want and save. Changes apply straight away.' },
];

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// ---------- Landing ----------

/**
 * @param {HTMLElement} app
 * @param {{ guilds: number | null, members: number | null, inviteUrl: string | null }} stats
 */
export function renderLanding(app, stats) {
    document.title = 'Ovx · The all-in-one Discord bot';

    const invite = (className) =>
        stats.inviteUrl
            ? el('a', {
                  className,
                  href: stats.inviteUrl,
                  target: '_blank',
                  rel: 'noopener',
                  textContent: 'Add to Discord',
              })
            : null;

    const statItems = [
        stats.guilds ? [compact.format(stats.guilds), stats.guilds === 1 ? 'server' : 'servers'] : null,
        stats.members ? [compact.format(stats.members), 'members'] : null,
        ['Free', 'to use'],
    ].filter(Boolean);

    app.replaceChildren(
        el('section', { className: 'landing-hero' }, [
            el('div', { className: 'landing-hero-text' }, [
                el('p', { className: 'eyebrow', textContent: 'Multipurpose Discord bot' }),
                el('h1', { className: 'landing-title' }, [
                    'Everything your server needs, ',
                    el('span', { className: 'accent-text', textContent: 'in one bot.' }),
                ]),
                el('p', {
                    className: 'landing-lead',
                    textContent:
                        'Levels, logs, tickets, welcome messages, stream alerts and more. Set it all up from one dashboard, no commands to remember.',
                }),
                el('div', { className: 'landing-actions' }, [
                    invite('button button-primary button-large'),
                    el('a', {
                        className: 'button button-ghost button-large',
                        href: '/auth/login',
                        textContent: 'Open dashboard',
                    }),
                ]),
                el(
                    'ul',
                    { className: 'landing-stats', 'aria-label': 'Ovx in numbers' },
                    statItems.map(([value, label]) =>
                        el('li', {}, [el('strong', { textContent: value }), el('span', { textContent: label })])
                    )
                ),
            ]),
            preview(),
        ]),

        el('section', { className: 'landing-section', id: 'features' }, [
            el('h2', { className: 'landing-heading', textContent: 'Built for the way communities run' }),
            el('p', {
                className: 'landing-subheading',
                textContent: 'Turn on only what you need, and set it all up in one place.',
            }),
            el(
                'div',
                { className: 'feature-grid' },
                FEATURES.map((feature) =>
                    el('article', { className: 'feature-card' }, [
                        el('div', { className: 'feature-icon' }, [icon(feature.icon)]),
                        el('h3', { textContent: feature.title }),
                        el('p', { textContent: feature.text }),
                    ])
                )
            ),
        ]),

        el('section', { className: 'landing-section' }, [
            el('h2', { className: 'landing-heading', textContent: 'Up and running in a minute' }),
            el(
                'ol',
                { className: 'steps' },
                STEPS.map((step, index) =>
                    el('li', { className: 'step' }, [
                        el('span', { className: 'step-number', textContent: String(index + 1), 'aria-hidden': 'true' }),
                        el('h3', { textContent: step.title }),
                        el('p', { textContent: step.text }),
                    ])
                )
            ),
        ]),

        el('section', { className: 'landing-cta' }, [
            el('h2', { textContent: 'Ready to give Ovx a try?' }),
            el('p', { textContent: 'It’s free. Add it to your server and set it up in a few clicks.' }),
            el('div', { className: 'landing-actions' }, [
                invite('button button-light button-large'),
                el('a', {
                    className: 'button button-outline-light button-large',
                    href: SUPPORT_URL,
                    target: '_blank',
                    rel: 'noopener',
                    textContent: 'Join the support server',
                }),
            ]),
        ])
    );

    // Arriving from another page via /#features: the browser looked for it before it existed
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

/** A made-up Discord channel showing a few things Ovx posts. Decorative only. */
function preview() {
    const botMessage = (time, children) =>
        el('div', { className: 'mock-message' }, [
            el('div', { className: 'mock-avatar' }),
            el('div', { className: 'mock-content' }, [
                el('div', { className: 'mock-author' }, [
                    el('span', { className: 'mock-name', textContent: 'Ovx' }),
                    el('span', { className: 'mock-tag', textContent: 'APP' }),
                    el('span', { className: 'mock-time', textContent: time }),
                ]),
                ...children,
            ]),
        ]);

    const embed = (className, children) => el('div', { className: `mock-embed ${className}` }, children);

    return el('div', { className: 'landing-preview', 'aria-hidden': 'true' }, [
        el('div', { className: 'mock-window' }, [
            el('div', { className: 'mock-header' }, [
                el('span', { className: 'mock-dots' }),
                el('span', { className: 'mock-channel', textContent: '# general' }),
            ]),
            el('div', { className: 'mock-body' }, [
                botMessage('Today at 18:02', [
                    embed('mock-embed-brand', [
                        el('strong', { textContent: 'Welcome to the server!' }),
                        el('p', { textContent: 'Hey @Alex, you’re member #1,204. Grab a role in #roles.' }),
                    ]),
                ]),
                botMessage('Today at 18:15', [
                    el('p', { className: 'mock-text', textContent: '🎉 @Sam reached level 12!' }),
                    el('div', { className: 'mock-progress' }, [el('span')]),
                ]),
                botMessage('Today at 19:00', [
                    embed('mock-embed-live', [
                        el('span', { className: 'mock-live', textContent: 'LIVE' }),
                        el('strong', { textContent: 'Nova is live on Twitch' }),
                        el('p', { textContent: 'Ranked grind, come say hi' }),
                    ]),
                    el('span', { className: 'mock-button', textContent: 'Watch on Twitch' }),
                ]),
            ]),
        ]),
    ]);
}

// ---------- Legal ----------

/**
 * @param {HTMLElement} app
 * @param {'tos' | 'privacypolicy'} page
 */
export function renderLegal(app, page) {
    const content = LEGAL_PAGES[page];
    document.title = `${content.title} · Ovx`;

    const paragraph = (part) =>
        Array.isArray(part)
            ? el(
                  'ul',
                  {},
                  part.map((item) => el('li', { textContent: item }))
              )
            : el('p', { textContent: part });

    app.replaceChildren(
        el('article', { className: 'legal' }, [
            el('h1', { className: 'page-title', textContent: content.title }),
            el('p', { className: 'legal-updated', textContent: `Last updated ${content.updated}` }),
            el('p', { className: 'legal-intro', textContent: content.intro }),
            ...content.sections.map((section) =>
                el('section', {}, [
                    el('h2', { textContent: section.heading }),
                    ...section.body.map(paragraph),
                    section.email &&
                        el('p', {}, [el('a', { href: `mailto:${CONTACT_EMAIL}`, textContent: CONTACT_EMAIL })]),
                ])
            ),
            el('p', { className: 'legal-closing', textContent: content.closing }),
            el('p', { className: 'legal-signoff', textContent: 'Ovx Development Team' }),
        ])
    );
    scrollTo(0, 0);
}
