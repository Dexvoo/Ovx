import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { MongoStore } from 'connect-mongo';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { createAuthRouter } from './auth.js';
import { createApiRouter } from './routes.js';
import { createShardBridge } from './shardBridge.js';
import { createMongoAuditStore } from './auditStore.js';
import { createMongoCaseStore } from '../features/moderation/utils/cases.js';
import { sameOrigin, requireJson } from './middleware.js';
import { createTopggWebhook } from '../features/votes/utils/webhook.js';
import { LogData } from '../shared/utils/logger.js';

const COOKIE_NAME = 'ovx.sid';
const SESSION_DAYS = 7;
const PUBLIC_DIR = fileURLToPath(new URL('./public', import.meta.url));
// Client-side routes that should load the UI instead of 404ing
// The old ovxbot.com addresses of the legal pages are kept, since the bot's Discord listing links to them
const UI_ROUTES = /^\/(servers|leaderboard|dev|tos|privacypolicy|status)(\/[\w-]*)*\/?$/;
// Bot Settings can include an avatar and a banner (each up to IMAGE_MAX_BYTES, base64 adds a third); every
// other request is small
const PROFILE_ROUTE = /^\/guilds\/\d{17,20}\/bot$/;
const smallJson = express.json({ limit: '32kb' });
const profileJson = express.json({ limit: '6mb' });

/**
 * Builds the dashboard Express app. Separate from startDashboard so tests can pass their own bridge
 * and session store.
 *
 * @param {{
 *   bridge: ReturnType<typeof createShardBridge>,
 *   env: import('../bootstrap/parseEnvironment.js').Environment,
 *   sessionStore?: session.Store,
 *   auditStore?: import('./auditStore.js').AuditStore,
 *   caseStore?: ReturnType<typeof createMongoCaseStore>,
 *   rateLimits?: { auth?: number, api?: number, writes?: number, webhook?: number },
 * }} options
 */
export function createDashboardApp({
    bridge,
    env,
    sessionStore,
    auditStore = createMongoAuditStore(),
    caseStore = createMongoCaseStore(),
    rateLimits = {},
}) {
    const config = env.DASHBOARD;
    const app = express();

    app.disable('x-powered-by');
    // Behind a reverse proxy, trust its X-Forwarded-* headers for the real client IP and https
    if (config.TRUST_PROXY) app.set('trust proxy', 1);

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
                    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                    imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com', 'https://media.discordapp.net'],
                    connectSrc: ["'self'"],
                    frameAncestors: ["'none'"],
                    formAction: ["'self'"],
                    upgradeInsecureRequests: config.SECURE ? [] : null,
                },
            },
            // Only meaningful over https; on localhost it would break plain http
            strictTransportSecurity: config.SECURE,
        })
    );

    // Top.gg's vote webhook. Its servers call it directly, so it comes before the session and same-origin
    // checks; the shared secret in its Authorization header is what proves the request is from Top.gg.
    if (env.TOPGG_WEBHOOK_SECRET) {
        app.post(
            '/webhooks/topgg',
            rateLimit({
                windowMs: 60_000,
                limit: rateLimits.webhook ?? 120,
                standardHeaders: 'draft-8',
                legacyHeaders: false,
            }),
            // The raw body is kept: Top.gg signs it exactly as sent
            express.json({
                limit: '8kb',
                verify: (req, res, buffer) => {
                    /** @type {any} */ (req).rawBody = buffer.toString('utf8');
                },
            }),
            createTopggWebhook({
                secret: env.TOPGG_WEBHOOK_SECRET,
                applicationId: env.APPLICATION_ID,
                logVote: async (userId, votes) => {
                    await bridge.voteReceived?.(userId);
                    await bridge.logVote(userId, votes);
                },
            })
        );
    }

    app.use(
        session({
            name: COOKIE_NAME,
            secret: config.SESSION_SECRET,
            store: sessionStore,
            resave: false,
            saveUninitialized: false, // No cookie until someone starts logging in
            rolling: true, // Active users stay logged in; idle sessions expire
            cookie: {
                httpOnly: true, // Not readable by page scripts
                sameSite: 'lax', // Not sent on cross-site requests that change things
                secure: config.SECURE,
                maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
            },
        })
    );

    // Everything that changes state must come from the dashboard itself
    app.use(sameOrigin(config.URL));

    const authLimiter = rateLimit({
        windowMs: 15 * 60_000,
        limit: rateLimits.auth ?? 30,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
    });
    const apiLimiter = rateLimit({
        windowMs: 60_000,
        limit: rateLimits.api ?? 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
    });
    const writeLimiter = rateLimit({
        windowMs: 60_000,
        limit: rateLimits.writes ?? 20,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skip: (req) => req.method === 'GET',
    });

    app.use(
        '/auth',
        authLimiter,
        createAuthRouter({ applicationId: env.APPLICATION_ID, config, cookieName: COOKIE_NAME })
    );
    app.use(
        '/api',
        apiLimiter,
        writeLimiter,
        requireJson,
        (req, res, next) => (PROFILE_ROUTE.test(req.path) ? profileJson : smallJson)(req, res, next),
        createApiRouter({
            bridge,
            applicationId: env.APPLICATION_ID,
            developerIds: env.DEVELOPER_IDS,
            auditStore,
            caseStore,
        })
    );

    // Browsers re-check every file (a quick 304 when unchanged), so updates always show, including
    // modules imported by other scripts, which a ?v= version in index.html wouldn't cover.
    const noCache = (res) => res.setHeader('Cache-Control', 'no-cache');
    app.use(express.static(PUBLIC_DIR, { index: 'index.html', setHeaders: noCache }));
    app.get(UI_ROUTES, (req, res) =>
        res.sendFile('index.html', { root: PUBLIC_DIR, headers: { 'Cache-Control': 'no-cache' } })
    );

    app.use((req, res) => res.status(404).json({ error: 'Not found' }));

    // Never send error details to the browser; they can reveal internals
    // eslint-disable-next-line no-unused-vars
    app.use((error, req, res, next) => {
        if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
        if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });

        LogData('Dashboard', `Request error on ${req.method} ${req.path}: ${error.stack ?? error.message}`, 'error');
        res.status(500).json({ error: 'Something went wrong' });
    });

    return app;
}

/**
 * Starts the dashboard in the ShardingManager process. Call after shards have spawned.
 * @param {{ manager: import('discord.js').ShardingManager, env: import('../bootstrap/parseEnvironment.js').Environment }} options
 * @returns {Promise<import('node:http').Server>}
 */
export async function startDashboard({ manager, env }) {
    const config = env.DASHBOARD;

    // The manager process has no database connection of its own; sessions are stored in MongoDB
    if (mongoose.connection.readyState !== 1) await mongoose.connect(env.MONGO_URI);

    const sessionStore = MongoStore.create({
        client: mongoose.connection.getClient(),
        collectionName: 'dashboard-sessions',
        ttl: SESSION_DAYS * 24 * 60 * 60,
    });

    const app = createDashboardApp({ bridge: createShardBridge(manager), env, sessionStore });

    return new Promise((resolve, reject) => {
        const server = app.listen(config.PORT, config.HOST, () => {
            LogData('Dashboard', `Running at ${config.URL} (listening on ${config.HOST}:${config.PORT})`, 'success');
            resolve(server);
        });
        server.on('error', reject);
    });
}
