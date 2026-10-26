// Server picker: servers with Ovx open their dashboard; servers without it are locked and offer an invite.
import { el, serverIcon, staticSvg, ICONS } from './ui.js';

const SEARCH_THRESHOLD = 8;

const inviteDialog = /** @type {HTMLDialogElement} */ (document.getElementById('invite-dialog'));
const inviteText = document.getElementById('invite-text');
const inviteConfirm = document.getElementById('invite-confirm');

/** The locked server whose invite prompt is open */
let inviting = null;
let waitingForInvite = false;
/** @type {(guildId: string) => void} */
let onInvited = () => {};

export function renderPickerSkeleton(app) {
    const tiles = Array.from({ length: 6 }, () =>
        el('div', { className: 'server skeleton', 'aria-hidden': 'true' }, [
            el('div', { className: 'server-icon' }),
            el('div', { className: 'server-name' }),
        ])
    );
    app.replaceChildren(
        el('div', { className: 'page-header' }, [
            el('h1', { className: 'page-title', textContent: 'Choose a server' }),
        ]),
        el('div', { className: 'server-grid' }, tiles)
    );
}

/**
 * @param {HTMLElement} app
 * @param {{ guilds: any[] }} me
 * @param {{ onInvited: (guildId: string) => void, refresh: () => Promise<{ guilds: any[] } | null> }} options
 */
export function renderPicker(app, me, options) {
    onInvited = options.onInvited;
    refreshMe = options.refresh;

    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    const guilds = [...me.guilds].sort(byName);

    const header = el('div', { className: 'page-header' }, [
        el('div', {}, [
            el('h1', { className: 'page-title', textContent: 'Choose a server' }),
            el('p', {
                className: 'page-subtitle',
                textContent: 'Servers where you have Manage Server. Greyed-out ones don’t have Ovx yet.',
            }),
        ]),
    ]);

    const results = el('div');
    const toolbar = el('div', { className: 'toolbar' });

    let search = null;
    if (guilds.length > SEARCH_THRESHOLD) {
        search = el('input', {
            className: 'search',
            type: 'search',
            placeholder: 'Search servers',
            'aria-label': 'Search servers',
        });
        search.addEventListener('input', () => renderResults());
        toolbar.append(search);
    }
    // Server lists come from Discord at login; logging in again picks up new servers
    toolbar.append(
        el('a', { className: 'button button-ghost', href: '/auth/login?returnTo=/', textContent: 'Refresh list' })
    );
    header.append(toolbar);

    function renderResults() {
        const query = search?.value.trim().toLowerCase() ?? '';
        const matching = guilds.filter((guild) => guild.name.toLowerCase().includes(query));
        const ready = matching.filter((guild) => guild.botPresent);
        const locked = matching.filter((guild) => !guild.botPresent);

        if (guilds.length === 0) {
            results.replaceChildren(
                el('p', {
                    className: 'empty',
                    textContent:
                        'You don’t have Manage Server in any servers yet. Ask a server owner for it, then use Refresh list.',
                })
            );
            return;
        }
        if (matching.length === 0) {
            results.replaceChildren(el('p', { className: 'empty', textContent: 'No servers match your search.' }));
            return;
        }

        results.replaceChildren(
            ready.length > 0 &&
                el('h2', { className: 'section-label', textContent: `Ready to manage · ${ready.length}` }),
            ready.length > 0 && el('div', { className: 'server-grid' }, ready.map(serverTile)),
            locked.length > 0 && el('h2', { className: 'section-label', textContent: `Add Ovx · ${locked.length}` }),
            locked.length > 0 && el('div', { className: 'server-grid' }, locked.map(serverTile))
        );
    }

    renderResults();
    app.replaceChildren(header, results);
}

function serverTile(guild) {
    if (guild.botPresent) {
        return el('a', { className: 'server', href: `/servers/${guild.id}`, dataset: { link: '' } }, [
            el('div', { className: 'server-icon-wrap' }, [serverIcon(guild)]),
            el('span', { className: 'server-name', textContent: guild.name }),
            el('span', { className: 'server-status', textContent: 'Manage' }),
        ]);
    }

    const tile = el(
        'button',
        { className: 'server locked', type: 'button', 'aria-label': `Invite Ovx to ${guild.name}` },
        [
            el('div', { className: 'server-icon-wrap' }, [
                serverIcon(guild),
                el('span', { className: 'lock-badge' }, [staticSvg(ICONS.lock)]),
            ]),
            el('span', { className: 'server-name', textContent: guild.name }),
            el('span', { className: 'server-status', textContent: 'Invite Ovx' }),
        ]
    );
    tile.addEventListener('click', () => openInvite(guild));
    return tile;
}

// ---------- Invite flow ----------

/** @type {() => Promise<{ guilds: any[] } | null>} */
let refreshMe = async () => null;

function openInvite(guild) {
    inviting = guild;
    waitingForInvite = false;
    document.getElementById('invite-icon').replaceChildren(serverIcon(guild, 64));
    document.getElementById('invite-title').textContent = `Ovx isn’t in ${guild.name} yet`;
    inviteText.textContent =
        'Invite Ovx to manage its settings here. Discord will open in a new tab so you can confirm.';
    inviteConfirm.textContent = 'Invite Ovx';
    inviteDialog.showModal();
}

document.getElementById('invite-cancel').addEventListener('click', () => inviteDialog.close());

inviteDialog.addEventListener('close', () => {
    inviting = null;
    waitingForInvite = false;
});

// Clicking the dimmed backdrop closes the dialog
inviteDialog.addEventListener('click', (event) => {
    if (event.target === inviteDialog) inviteDialog.close();
});

inviteConfirm.addEventListener('click', () => {
    if (!inviting) return;
    if (waitingForInvite) return checkInvite();

    // noopener: the Discord tab gets no reference back to this page
    window.open(inviting.inviteUrl, '_blank', 'noopener');
    waitingForInvite = true;
    inviteText.textContent =
        'Finish adding Ovx in the Discord tab, then come back here. This page checks again automatically.';
    inviteConfirm.textContent = 'I’ve added it';
});

// Coming back from the Discord tab: see if the bot is in the server now
window.addEventListener('focus', () => {
    if (waitingForInvite) checkInvite();
});

async function checkInvite() {
    const guildId = inviting?.id;
    if (!guildId) return;

    const me = await refreshMe();
    const updated = me?.guilds.find((guild) => guild.id === guildId);
    if (updated?.botPresent) {
        inviteDialog.close();
        onInvited(guildId);
    } else {
        inviteText.textContent = 'Ovx isn’t in that server yet. Finish adding it in the Discord tab, then try again.';
    }
}
