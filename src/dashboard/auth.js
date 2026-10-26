import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { LogData } from '../shared/utils/logger.js';

const DISCORD_API = 'https://discord.com/api/v10';
// identify: who the user is. guilds: which servers they're in, to list the ones they manage.
const SCOPES = 'identify guilds';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

/**
 * Discord OAuth2 login ("Log in with Discord").
 *
 * Security notes:
 * - A random `state` value ties the callback to the browser that started the login (stops login CSRF).
 * - The session ID is regenerated after login (stops session fixation).
 * - Discord access tokens are used once to read the user and their servers, then revoked; nothing
 *   that could act on the user's Discord account is ever stored.
 * - The client secret only ever leaves this server in the request to Discord's token endpoint.
 *
 * @param {{ applicationId: string, config: import('../bootstrap/parseEnvironment.js').DashboardConfig, cookieName: string }} options
 */
export function createAuthRouter({ applicationId, config, cookieName }) {
    const router = Router();
    const redirectUri = `${config.URL}/auth/callback`;
    const basicAuth = Buffer.from(`${applicationId}:${config.CLIENT_SECRET}`).toString('base64');

    router.get('/login', (req, res, next) => {
        const state = randomBytes(32).toString('base64url');
        req.session.oauthState = state;
        req.session.returnTo = safeReturnPath(req.query.returnTo);

        const params = new URLSearchParams({
            client_id: applicationId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: SCOPES,
            state,
            prompt: 'none', // Skip the consent screen if the user already approved
        });

        req.session.save((error) => {
            if (error) return next(error);
            res.redirect(`https://discord.com/oauth2/authorize?${params}`);
        });
    });

    router.get('/callback', async (req, res, next) => {
        const { code, state, error } = req.query;
        const expectedState = req.session.oauthState;
        const returnTo = req.session.returnTo ?? '/';
        delete req.session.oauthState;
        delete req.session.returnTo;

        if (error) return res.redirect('/?login=cancelled');
        if (
            typeof code !== 'string' ||
            typeof state !== 'string' ||
            !expectedState ||
            !safeEqual(state, expectedState)
        ) {
            // Expired, reused, or started in a different browser
            return res.redirect('/?login=expired');
        }

        try {
            const token = await discordRequest('/oauth2/token', {
                method: 'POST',
                headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
            });

            const auth = { Authorization: `Bearer ${token.access_token}` };
            const [user, guilds] = await Promise.all([
                discordRequest('/users/@me', { headers: auth }),
                discordRequest('/users/@me/guilds', { headers: auth }),
            ]);

            revokeToken(token.access_token, basicAuth);

            // New session ID on login, keeping nothing from the anonymous session
            req.session.regenerate((regenerateError) => {
                if (regenerateError) return next(regenerateError);

                req.session.user = {
                    id: user.id,
                    username: user.username,
                    displayName: user.global_name ?? user.username,
                    avatar: user.avatar
                        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
                        : defaultAvatar(user.id),
                };
                // Only servers they can manage; the shard re-checks live on every request anyway
                req.session.guilds = guilds
                    .filter((guild) => guild.owner || canManage(guild.permissions))
                    .map((guild) => ({
                        id: guild.id,
                        name: guild.name,
                        icon: guild.icon
                            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`
                            : null,
                    }));

                req.session.save((saveError) => (saveError ? next(saveError) : res.redirect(returnTo)));
            });
        } catch (loginError) {
            LogData('Dashboard', `Login failed: ${loginError.message}`, 'warning');
            res.redirect('/?login=failed');
        }
    });

    router.post('/logout', (req, res, next) => {
        req.session.destroy((error) => {
            if (error) return next(error);
            res.clearCookie(cookieName);
            res.status(204).end();
        });
    });

    return router;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function discordRequest(path, init = {}) {
    const response = await fetch(`${DISCORD_API}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Discord ${path} responded ${response.status}`);
    return response.json();
}

/**
 * Best effort: the token is never stored, revoking just limits its lifetime further.
 * @param {string} accessToken
 * @param {string} basicAuth
 */
function revokeToken(accessToken, basicAuth) {
    discordRequest('/oauth2/token/revoke', {
        method: 'POST',
        headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken, token_type_hint: 'access_token' }),
    }).catch(() => {});
}

/** @param {string} permissions - Bitfield string from Discord */
function canManage(permissions) {
    try {
        const bits = BigInt(permissions);
        return (bits & MANAGE_GUILD) !== 0n || (bits & ADMINISTRATOR) !== 0n;
    } catch {
        return false;
    }
}

/**
 * Discord's default avatar for users who haven't set one (same formula Discord uses).
 * @param {string} userId
 */
function defaultAvatar(userId) {
    return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(userId) >> 22n) % 6n)}.png`;
}

/**
 * Constant-time comparison, so the state can't be guessed byte by byte from response timing.
 * @param {string} a
 * @param {string} b
 */
function safeEqual(a, b) {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

/**
 * Only same-site paths, so a crafted login link can't send users to another website afterwards.
 * @param {unknown} value
 */
export function safeReturnPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
        return '/';
    }
    return value.length <= 200 ? value : '/';
}
