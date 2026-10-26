// Ovx dashboard front-end: routing, account bar and start-up.
// Pages live in landing.js (landing and legal pages), picker.js (server picker) and serverPage.js
// (sidebar + sections).
import { el, api } from './ui.js';
import { confirmLeave } from './forms.js';
import { renderPicker, renderPickerSkeleton } from './picker.js';
import { renderServerPage, clearServerCache } from './serverPage.js';
import { renderLanding, renderLegal } from './landing.js';
import { renderStatus } from './status.js';
import { renderDeveloper } from './developer.js';

const app = document.getElementById('app');
const banner = document.getElementById('banner');

const LOGIN_MESSAGES = {
    cancelled: 'Login was cancelled.',
    expired: 'That login link expired. Please try again.',
    failed: 'Discord login failed. Please try again.',
};

/** @type {{ user: any, guilds: any[] } | null} */
let me = null;
/** Cleanup for the section currently shown (stops its unsaved-changes guard) */
let cleanup = () => {};
let currentPath = location.pathname;
/** Landing page numbers and invite link, fetched once */
let stats = null;

// Remembers that this browser was logged in last time, so returning users see the server list loading
// instead of the landing page flashing up first. Only a hint: the session decides what is shown.
const SIGNED_IN_HINT = 'ovx-signed-in';

function rememberSignedIn(signedIn) {
    try {
        if (signedIn) localStorage.setItem(SIGNED_IN_HINT, '1');
        else localStorage.removeItem(SIGNED_IN_HINT);
    } catch {
        // Storage blocked (private window): just skip the hint
    }
}

function wasSignedIn() {
    try {
        return localStorage.getItem(SIGNED_IN_HINT) === '1';
    } catch {
        return false;
    }
}

// ---------- Navigation ----------

function navigate(path) {
    if (path === location.pathname) return;
    if (!confirmLeave()) return;
    history.pushState(null, '', path);
    render();
}

document.addEventListener('click', (event) => {
    const link = /** @type {Element} */ (event.target).closest('a[data-link]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
});

window.addEventListener('popstate', () => {
    // Back/forward can't be cancelled, so undo it if the user wants to stay
    if (!confirmLeave()) {
        history.pushState(null, '', currentPath);
        return;
    }
    render();
});

// ---------- Account ----------

async function loadMe() {
    const { status, data } = await api('/api/me');
    me = status === 200 ? data : null;
    rememberSignedIn(Boolean(me));
    renderAccount();
    return me;
}

function renderAccount() {
    const account = document.getElementById('account');
    account.hidden = !me;
    document.getElementById('topnav').hidden = Boolean(me);
    if (!me) return;

    const avatar = /** @type {HTMLImageElement} */ (document.getElementById('account-avatar'));
    // Sessions from before default avatars were added may not have one
    avatar.hidden = !me.user.avatar;
    if (me.user.avatar) avatar.src = me.user.avatar;
    document.getElementById('account-name').textContent = me.user.displayName;
    document.getElementById('dev-link').hidden = !me.user.isDeveloper;
}

document.getElementById('logout').addEventListener('click', async () => {
    if (!confirmLeave()) return;
    cleanup();
    cleanup = () => {};
    await fetch('/auth/logout', { method: 'POST' });
    me = null;
    rememberSignedIn(false);
    clearServerCache();
    renderAccount();
    history.pushState(null, '', '/');
    render();
});

// ---------- Pages ----------

function renderLoggedOut() {
    app.replaceChildren(
        el('section', { className: 'hero' }, [
            el('div', { className: 'hero-mark', 'aria-hidden': 'true' }),
            el('h1', { textContent: 'Ovx Dashboard' }),
            el('p', { textContent: 'Log in with Discord to manage Ovx in your servers.' }),
            el('a', {
                className: 'button button-primary button-large',
                // Back to this page afterwards, e.g. a server's settings opened from /dashboard
                href: `/auth/login?returnTo=${encodeURIComponent(location.pathname)}`,
                textContent: 'Log in with Discord',
            }),
        ])
    );
}

async function loadStats() {
    if (stats) return stats;
    const { status, data } = await api('/api/public/stats').catch(() => ({ status: 0, data: null }));
    if (status !== 200) return { guilds: null, members: null, inviteUrl: null };
    stats = data;
    return stats;
}

async function render() {
    cleanup();
    cleanup = () => {};
    currentPath = location.pathname;
    document.title = 'Ovx Dashboard';

    const route = location.pathname.match(/^\/servers\/(\d{17,20})(?:\/([\w-]+))?\/?$/);
    const legal = location.pathname.match(/^\/(tos|privacypolicy)\/?$/);
    app.classList.toggle('page-wide', Boolean(route));

    // Open to everyone; the account bar fills in once we know who is looking
    if (/^\/status\/?$/.test(location.pathname)) {
        cleanup = renderStatus(app);
        if (!me) await loadMe();
        return;
    }
    if (legal) {
        renderLegal(app, /** @type {'tos' | 'privacypolicy'} */ (legal[1]));
        if (!me) await loadMe();
        return;
    }

    if (!me && route) await loadMe();
    if (!me && !route) {
        if (wasSignedIn()) renderPickerSkeleton(app);
        const [, landingStats] = await Promise.all([loadMe(), loadStats()]);
        if (!me) return renderLanding(app, landingStats);
    }
    if (!me) return renderLoggedOut();

    if (/^\/dev\/?$/.test(location.pathname)) {
        cleanup = renderDeveloper(app);
        return;
    }

    if (route) {
        cleanup = await renderServerPage(app, route[1], route[2] ?? '', () => {
            me = null;
            renderAccount();
            renderLoggedOut();
        });
        return;
    }

    renderPicker(app, me, {
        refresh: loadMe,
        onInvited: (guildId) => navigate(`/servers/${guildId}`),
    });
}

// ---------- Start ----------

// Show login errors once, then tidy the address bar
const loginResult = new URLSearchParams(location.search).get('login');
if (loginResult) {
    banner.textContent = LOGIN_MESSAGES[loginResult] ?? '';
    banner.hidden = !banner.textContent;
    history.replaceState(null, '', location.pathname);
}

render().catch(() => {
    app.replaceChildren(
        el('p', { className: 'empty', textContent: 'Could not reach the dashboard. Is the bot running?' })
    );
});
