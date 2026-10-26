// Shared front-end helpers.
// Security: user-controlled text (server, channel, role and user names) is only ever set with
// textContent or element properties, never innerHTML, so it can't inject markup or scripts.

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any>} [props] - Properties set directly on the element (className, textContent…)
 * @param {(Node | string | null | false | undefined)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key === 'dataset') Object.assign(element.dataset, value);
        else if (key.startsWith('aria-') || key === 'role' || key === 'for') element.setAttribute(key, value);
        else element[key] = value;
    }
    for (const child of children) if (child) element.append(child);
    return element;
}

/** Static, trusted markup only (icons defined in this codebase). Never pass user data. */
export function staticSvg(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content.firstElementChild;
}

export const ICONS = {
    lock: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 12 6h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.3 3.3 8 7l3.7-3.7 1 1L9 8l3.7 3.7-1 1L8 9l-3.7 3.7-1-1L7 8 3.3 4.3z"/></svg>',
};

function initials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? [words[0], words[1]] : [words[0] ?? '?'];
    return letters.map((word) => Array.from(word)[0]?.toUpperCase() ?? '').join('');
}

function hueClass(id) {
    let sum = 0;
    for (const char of id) sum += char.charCodeAt(0);
    return `hue-${sum % 6}`;
}

/** The server's own icon, or its initials on a purple tile if it has none. */
export function serverIcon(guild, size = 76) {
    if (guild.icon) {
        return el('img', {
            className: 'server-icon',
            src: guild.icon,
            alt: '',
            width: size,
            height: size,
            loading: 'lazy',
        });
    }
    return el('div', {
        className: `server-icon ${hueClass(guild.id)}`,
        textContent: initials(guild.name),
        'aria-hidden': 'true',
    });
}

/**
 * GET JSON from the dashboard API.
 * @returns {Promise<{ status: number, data: any }>}
 */
export async function api(path) {
    const response = await fetch(path, { headers: { accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
}

/**
 * Send JSON to the dashboard API (same-origin, so the browser adds the Origin header the server checks).
 * @param {'PUT' | 'POST' | 'DELETE'} method
 * @returns {Promise<{ status: number, data: any }>}
 */
export async function apiSend(method, path, body) {
    const response = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
}

/**
 * Short message in the corner.
 * @param {string} message
 * @param {'success' | 'error'} [kind]
 */
export function toast(message, kind = 'success') {
    let region = document.getElementById('toasts');
    if (!region) {
        region = el('div', { id: 'toasts', className: 'toasts', role: 'status', 'aria-live': 'polite' });
        document.body.append(region);
    }
    const item = el('div', { className: `toast toast-${kind}`, textContent: message });
    region.append(item);
    setTimeout(() => item.remove(), 4000);
}
