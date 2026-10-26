const SNOWFLAKE = /^\d{17,20}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Rejects requests without a logged-in session. */
export function requireLogin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    next();
}

/**
 * Only for DEVELOPER_IDS. Responds 404 rather than 403 so the panel's existence isn't advertised.
 * @param {string[]} developerIds
 */
export function requireDeveloper(developerIds) {
    return (req, res, next) => {
        if (!req.session.user || !developerIds.includes(req.session.user.id)) {
            return res.status(404).json({ error: 'Not found' });
        }
        next();
    };
}

/** 404s any :guildId that isn't a Discord ID, before it reaches a shard. */
export function validGuildId(req, res, next) {
    if (!SNOWFLAKE.test(req.params.guildId)) return res.status(404).json({ error: 'Server not found' });
    next();
}

/**
 * Blocks cross-site requests that change things (CSRF). Browsers always send Origin on these, so a
 * page on another site can't make a logged-in user's browser save settings.
 * The SameSite=Lax session cookie is a second layer of the same protection.
 * @param {string} dashboardUrl
 */
export function sameOrigin(dashboardUrl) {
    const expected = new URL(dashboardUrl).origin;

    return (req, res, next) => {
        if (SAFE_METHODS.has(req.method)) return next();

        const origin = req.get('origin') ?? originOf(req.get('referer'));
        if (origin !== expected)
            return res.status(403).json({ error: 'Request blocked: it did not come from the dashboard' });
        next();
    };
}

/**
 * Requires JSON bodies on requests that send data, so form posts from other sites can't be parsed.
 */
export function requireJson(req, res, next) {
    if (SAFE_METHODS.has(req.method) || req.method === 'DELETE') return next();
    if (!req.is('application/json')) return res.status(415).json({ error: 'Expected JSON' });
    next();
}

/** @param {string | undefined} url */
function originOf(url) {
    try {
        return url ? new URL(url).origin : undefined;
    } catch {
        return undefined;
    }
}
