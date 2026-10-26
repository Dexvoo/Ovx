// A server's dashboard: sidebar of categories on the left, the chosen section on the right.
import { el, api, serverIcon } from './ui.js';
import { renderLevels } from './levels.js';
import { renderLogging } from './logging.js';
import { renderWebLogs } from './webLogs.js';
import { renderBotSettings } from './botSettings.js';
import { renderAutoRoles } from './autoRoles.js';
import { renderWelcome } from './welcome.js';
import { renderTickets } from './tickets.js';
import { streamsPage } from './streams.js';
import { renderModeration } from './moderation.js';
import { renderGiveaways } from './giveaways.js';
import { renderReactionRoles } from './reactionRoles.js';
import { renderInviteBlocker } from './inviteBlocker.js';
import { renderHoneypot } from './honeypot.js';
import { renderCustomEmbeds } from './customEmbeds.js';
import { renderStarboard } from './starboard.js';
import { renderAutomod } from './automod.js';
import { renderTempVoice } from './tempVoice.js';
import { renderSuggestions } from './suggestions.js';
import { renderVerification } from './verification.js';
import { renderCommands } from './commands.js';
import { renderServerStats } from './serverStats.js';
import { renderAutoMessages } from './autoMessages.js';

/**
 * Sidebar layout. Items with a `render` are live; the rest are planned and shown as "Soon".
 * @type {{ label: string, items: { slug: string, label: string, render?: Function }[] }[]}
 */
export const SECTIONS = [
    {
        label: 'Settings',
        items: [
            { slug: 'bot-settings', label: 'Bot Settings', render: renderBotSettings },
            { slug: 'commands', label: 'Commands', render: renderCommands },
            { slug: 'web-logs', label: 'Web Logs', render: renderWebLogs },
        ],
    },
    {
        label: 'Moderation',
        items: [
            { slug: 'moderation', label: 'Moderation', render: renderModeration },
            { slug: 'logging', label: 'Logging', render: renderLogging },
            { slug: 'automod', label: 'AutoMod', render: renderAutomod },
            { slug: 'verification', label: 'Verification', render: renderVerification },
            { slug: 'invite-blocker', label: 'Invite Blocker', render: renderInviteBlocker },
            { slug: 'honeypot', label: 'Honeypot', render: renderHoneypot },
            { slug: 'tickets', label: 'Tickets', render: renderTickets },
        ],
    },
    {
        label: 'Roles',
        items: [
            { slug: 'reaction-roles', label: 'Reaction Roles', render: renderReactionRoles },
            { slug: 'auto-roles', label: 'Auto Roles', render: renderAutoRoles },
        ],
    },
    {
        label: 'Notifications',
        items: [
            { slug: 'twitch', label: 'Twitch', render: streamsPage('twitch') },
            { slug: 'youtube', label: 'YouTube', render: streamsPage('youtube') },
            { slug: 'kick', label: 'Kick', render: streamsPage('kick') },
        ],
    },
    {
        label: 'Utility',
        items: [
            { slug: 'levels', label: 'Levels', render: renderLevels },
            { slug: 'welcome-messages', label: 'Welcome Messages', render: renderWelcome },
            { slug: 'giveaways', label: 'Giveaways', render: renderGiveaways },
            { slug: 'suggestions', label: 'Suggestions', render: renderSuggestions },
            { slug: 'join-to-create', label: 'Join to Create', render: renderTempVoice },
            { slug: 'server-stats', label: 'Server Stats', render: renderServerStats },
            { slug: 'auto-messages', label: 'Auto Messages', render: renderAutoMessages },
            { slug: 'custom-embeds', label: 'Custom Embeds', render: renderCustomEmbeds },
            { slug: 'starboard', label: 'Starboard', render: renderStarboard },
        ],
    },
];

export const DEFAULT_SECTION = 'levels';

const ITEMS = SECTIONS.flatMap((group) => group.items);

/** Overview for the server currently open, reused while switching sections */
let cached = null;

/**
 * @param {HTMLElement} app
 * @param {string} guildId
 * @param {string} slug
 * @param {() => void} onLoggedOut
 * @returns {Promise<() => void>} Cleanup for the section
 */
export async function renderServerPage(app, guildId, slug, onLoggedOut) {
    const item =
        ITEMS.find((entry) => entry.slug === slug && entry.render) ??
        ITEMS.find((entry) => entry.slug === DEFAULT_SECTION);

    if (cached?.guild.id !== guildId) {
        app.replaceChildren(el('p', { className: 'page-subtitle loading', textContent: 'Loading server…' }));
        const { status, data } = await api(`/api/guilds/${encodeURIComponent(guildId)}`);
        if (status === 401) {
            onLoggedOut();
            return () => {};
        }
        if (status !== 200) {
            cached = null;
            app.replaceChildren(
                el('a', { className: 'back-link', href: '/', dataset: { link: '' }, textContent: '← All servers' }),
                el('p', { className: 'empty', textContent: data?.error ?? 'Could not load this server.' })
            );
            return () => {};
        }
        cached = data;
    }

    const content = el('div', { className: 'server-content' });
    app.replaceChildren(el('div', { className: 'server-layout' }, [sidebar(cached.guild, item.slug), content]));

    // On phones the sidebar is a horizontal strip; bring the current section into view
    const nav = app.querySelector('.sidebar-nav');
    const active = /** @type {HTMLElement | null} */ (app.querySelector('.sidebar-link.active'));
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
        nav.scrollLeft = active.offsetLeft - nav.clientWidth / 2 + active.offsetWidth / 2;
    }
    return item.render(content, cached) ?? (() => {});
}

/** Forget the cached server, e.g. after logging out */
export function clearServerCache() {
    cached = null;
}

function sidebar(guild, activeSlug) {
    return el('aside', { className: 'sidebar', 'aria-label': 'Server sections' }, [
        el('a', { className: 'back-link', href: '/', dataset: { link: '' }, textContent: '← All servers' }),
        el('div', { className: 'sidebar-server' }, [
            serverIcon(guild, 40),
            el('span', { className: 'sidebar-server-name', textContent: guild.name }),
        ]),
        el(
            'nav',
            { className: 'sidebar-nav' },
            SECTIONS.map((group) =>
                el('div', { className: 'sidebar-group' }, [
                    el('h2', { className: 'sidebar-heading', textContent: group.label }),
                    el(
                        'ul',
                        { className: 'sidebar-list' },
                        group.items.map((item) => el('li', {}, [sidebarItem(guild, item, item.slug === activeSlug)]))
                    ),
                ])
            )
        ),
    ]);
}

function sidebarItem(guild, item, active) {
    if (!item.render) {
        return el('span', { className: 'sidebar-link sidebar-link-soon', 'aria-disabled': 'true' }, [
            el('span', { textContent: item.label }),
            el('span', { className: 'soon-pill', textContent: 'Soon' }),
        ]);
    }
    return el('a', {
        className: `sidebar-link${active ? ' active' : ''}`,
        href: `/servers/${guild.id}/${item.slug}`,
        dataset: { link: '' },
        textContent: item.label,
        'aria-current': active ? 'page' : 'false',
    });
}
