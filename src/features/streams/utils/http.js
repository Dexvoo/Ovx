/** A request to a streaming platform that failed. */
export class PlatformError extends Error {
    /**
     * @param {string} message
     * @param {number} [status] - HTTP status, when the platform answered
     */
    constructor(message, status) {
        super(message);
        this.name = 'PlatformError';
        this.status = status;
    }
}

/**
 * Fetches with a timeout, so a slow platform can't hold up the bot.
 * @param {string | URL} url
 * @param {RequestInit & { timeoutMs?: number }} [options]
 * @returns {Promise<Response>}
 */
export async function request(url, { timeoutMs = 10_000, ...options } = {}) {
    let response;
    try {
        response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
        throw new PlatformError(`Could not reach ${new URL(url).host}: ${error.message}`);
    }
    if (!response.ok) throw new PlatformError(`${new URL(url).host} answered ${response.status}`, response.status);
    return response;
}

/**
 * @param {string | URL} url
 * @param {RequestInit & { timeoutMs?: number }} [options]
 */
export async function requestJson(url, options) {
    return (await request(url, options)).json();
}

/**
 * Keeps an app access token (client credentials) and fetches a new one shortly before it expires.
 * @param {() => Promise<{ token: string, expiresInSeconds: number }>} fetchToken
 */
export function tokenCache(fetchToken) {
    let token = null;
    let expiresAt = 0;
    /** @type {Promise<string> | null} */
    let pending = null;

    return {
        /** @returns {Promise<string>} */
        async get() {
            if (token && Date.now() < expiresAt) return token;
            // Requests at the same moment share one token request
            pending ??= fetchToken()
                .then((result) => {
                    token = result.token;
                    expiresAt = Date.now() + (result.expiresInSeconds - 60) * 1000;
                    return token;
                })
                .finally(() => {
                    pending = null;
                });
            return pending;
        },
        /** Forgets the token (after the platform rejected it). */
        clear() {
            token = null;
            expiresAt = 0;
        },
    };
}

/**
 * Splits a list into chunks (platforms limit how many accounts one request can ask about).
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
    return chunks;
}
