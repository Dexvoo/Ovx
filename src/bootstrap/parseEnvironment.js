const SNOWFLAKE = /^\d{17,20}$/;

/**
 * @typedef {Object} Environment
 * @property {string} MONGO_URI
 * @property {string} DEFAULT_LANGUAGE - i18n locale code, defaults to en-GB
 * @property {boolean} DEVELOPER_MODE
 * @property {string} TOKEN - Bot token for the current mode (BOT_TOKEN, or BOT_TOKEN_DEV in developer mode)
 * @property {string} APPLICATION_ID - Application ID for the current mode
 * @property {string | null} DEV_GUILD_ID - Developer guild; dev commands and dev logs need it
 * @property {string[]} DEVELOPER_IDS - User IDs allowed to use developer-only commands
 * @property {string | null} COMMAND_CID - Dev log channel for command usage
 * @property {string | null} JOIN_GUILD_CID - Dev log channel for guild joins
 * @property {string | null} LEAVE_GUILD_CID - Dev log channel for guild leaves
 * @property {string | null} USER_LEVEL_CID - Dev log channel for level-ups
 * @property {string | null} VOTE_CID - Dev log channel for votes
 * @property {string | null} ERROR_CID - Dev log channel for errors (commands, events, dashboard actions, crashes)
 * @property {DashboardConfig | null} DASHBOARD - null when the dashboard is disabled
 * @property {StreamsConfig} STREAMS - Keys for stream notifications; a platform without keys is switched off
 * @property {string | null} TRANSLATE_API_KEY - Google Cloud Translation API key; translating is off without it
 * @property {string | null} TOPGG_WEBHOOK_SECRET - Top.gg webhook secret (whs_…), or the older webhooks' Authorization (needs the dashboard)
 * @property {string | null} TOPGG_TOKEN - Top.gg API token, for posting the server count
 * @property {BackupsConfig} BACKUPS - Daily database backups
 */

/**
 * @typedef {Object} BackupsConfig
 * @property {boolean} ENABLED - Daily backups run (off in developer mode unless BACKUPS_ENABLED is 'true')
 * @property {string} DIR - Folder for backup files, relative to the project folder
 * @property {number} KEEP - How many backup files to keep there
 * @property {number} HOUR - Hour of the day (UTC) the daily backup runs
 * @property {string | null} CHANNEL_ID - Private channel each backup is also uploaded to
 */

/**
 * @typedef {Object} StreamsConfig
 * @property {{ CLIENT_ID: string, CLIENT_SECRET: string } | null} TWITCH - From dev.twitch.tv/console
 * @property {{ CLIENT_ID: string, CLIENT_SECRET: string } | null} KICK - From kick.com (Settings → Developer)
 * @property {string | null} YOUTUBE_API_KEY - Optional: new videos work without it; live streams need it
 */

/**
 * @typedef {Object} DashboardConfig
 * @property {number} PORT
 * @property {string} HOST - Interface to listen on; 127.0.0.1 (this machine only) unless DASHBOARD_HOST is set
 * @property {string} URL - Public base URL with no trailing slash, e.g. https://dash.example.com
 * @property {boolean} SECURE - Whether URL is https (cookies are then marked Secure)
 * @property {boolean} TRUST_PROXY - Set when behind a reverse proxy (nginx, Caddy) that terminates HTTPS
 * @property {string} CLIENT_SECRET - OAuth2 client secret for the current mode
 * @property {string} SESSION_SECRET - Signs session cookies; at least 32 characters
 */

/**
 * Validates environment variables and builds the bot's config.
 * Pure (no exiting or logging) so it can be tested; environment.js handles failures.
 *
 * Only MONGO_URI and the token/application ID for the current mode are required.
 * Everything else is optional: unset, empty or 'none' all mean "not configured".
 *
 * @param {Record<string, string | undefined>} env - Usually process.env
 * @returns {{ env: Environment | null, errors: string[], warnings: string[] }} errors is empty when env is valid
 */
export function parseEnvironment(env) {
    const errors = [];
    const warnings = [];

    /** @param {string} name */
    const optional = (name) => {
        const value = env[name]?.trim();
        return value && value.toLowerCase() !== 'none' ? value : null;
    };

    /** @param {string} name */
    const required = (name) => {
        const value = optional(name);
        if (!value) errors.push(`${name} is required`);
        return value;
    };

    /** @param {string} name */
    const snowflake = (name, value = optional(name)) => {
        if (value && !SNOWFLAKE.test(value)) errors.push(`${name} must be a Discord ID (17-20 digits), got "${value}"`);
        return value;
    };

    const developerMode = optional('DEVELOPER_MODE') === 'true';
    const tokenName = developerMode ? 'BOT_TOKEN_DEV' : 'BOT_TOKEN';
    const applicationIdName = developerMode ? 'BOT_APPLICATION_ID_DEV' : 'BOT_APPLICATION_ID';

    const developerIds = (optional('DEVELOPER_IDS') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    for (const id of developerIds) snowflake('DEVELOPER_IDS', id);

    // Renamed from the misspelled JOIN_GUID_CID; the old name is still accepted so existing setups keep working
    let joinGuildChannel = optional('JOIN_GUILD_CID');
    if (!joinGuildChannel && optional('JOIN_GUID_CID')) {
        joinGuildChannel = optional('JOIN_GUID_CID');
        warnings.push('JOIN_GUID_CID is deprecated, rename it to JOIN_GUILD_CID');
    }

    const dashboard = optional('DASHBOARD_ENABLED') === 'true' ? parseDashboard() : null;

    /**
     * A client ID and secret pair; half a pair is a warning (the platform stays off).
     * @param {string} label
     * @param {string} prefix - e.g. TWITCH reads TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
     */
    const clientPair = (label, prefix) => {
        const id = optional(`${prefix}_CLIENT_ID`);
        const secret = optional(`${prefix}_CLIENT_SECRET`);
        if (id && secret) return { CLIENT_ID: id, CLIENT_SECRET: secret };
        if (id || secret) {
            warnings.push(`${label} notifications are off: set both ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET`);
        }
        return null;
    };
    const streams = {
        TWITCH: clientPair('Twitch', 'TWITCH'),
        KICK: clientPair('Kick', 'KICK'),
        YOUTUBE_API_KEY: optional('YOUTUBE_API_KEY'),
    };

    const backupKeep = Number(optional('BACKUP_KEEP') ?? 14);
    if (!Number.isInteger(backupKeep) || backupKeep < 1 || backupKeep > 365) {
        errors.push(`BACKUP_KEEP must be a number from 1 to 365, got "${env.BACKUP_KEEP}"`);
    }
    const backupHour = Number(optional('BACKUP_HOUR') ?? 4);
    if (!Number.isInteger(backupHour) || backupHour < 0 || backupHour > 23) {
        errors.push(`BACKUP_HOUR must be an hour from 0 to 23, got "${env.BACKUP_HOUR}"`);
    }
    const backupsSetting = optional('BACKUPS_ENABLED');
    const backups = {
        // On by default, except in developer mode (which usually runs a second copy of the bot)
        ENABLED: backupsSetting ? backupsSetting === 'true' : !developerMode,
        DIR: optional('BACKUP_DIR') ?? 'backups',
        KEEP: backupKeep,
        HOUR: backupHour,
        CHANNEL_ID: snowflake('BACKUP_CID'),
    };

    function parseDashboard() {
        const port = Number(optional('DASHBOARD_PORT') ?? 3000);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            errors.push(`DASHBOARD_PORT must be a port number (1-65535), got "${env.DASHBOARD_PORT}"`);
        }

        const url = (optional('DASHBOARD_URL') ?? `http://localhost:${port}`).replace(/\/+$/, '');
        let secure = false;
        try {
            const { protocol, hostname } = new URL(url);
            secure = protocol === 'https:';
            const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
            if (!secure && !isLocal) {
                errors.push(
                    'DASHBOARD_URL must use https:// unless it is localhost (logins would be sent unencrypted)'
                );
            }
        } catch {
            errors.push(`DASHBOARD_URL must be a full URL like https://dash.example.com, got "${url}"`);
        }

        const secretName = developerMode ? 'BOT_CLIENT_SECRET_DEV' : 'BOT_CLIENT_SECRET';
        const sessionSecret = required('SESSION_SECRET');
        if (sessionSecret && sessionSecret.length < 32) {
            errors.push('SESSION_SECRET must be at least 32 characters (see .env.example for how to generate one)');
        }

        return {
            PORT: port,
            HOST: optional('DASHBOARD_HOST') ?? '127.0.0.1',
            URL: url,
            SECURE: secure,
            TRUST_PROXY: optional('DASHBOARD_TRUST_PROXY') === 'true',
            CLIENT_SECRET: required(secretName),
            SESSION_SECRET: sessionSecret,
        };
    }

    const parsed = {
        MONGO_URI: required('MONGO_URI'),
        DEFAULT_LANGUAGE: optional('DEFAULT_LANGUAGE') ?? 'en-GB',

        DEVELOPER_MODE: developerMode,
        TOKEN: required(tokenName),
        APPLICATION_ID: snowflake(applicationIdName, required(applicationIdName)),

        DEV_GUILD_ID: snowflake('DEV_GUILD_ID'),
        DEVELOPER_IDS: developerIds,

        COMMAND_CID: snowflake('COMMAND_CID'),
        JOIN_GUILD_CID: snowflake('JOIN_GUILD_CID', joinGuildChannel),
        LEAVE_GUILD_CID: snowflake('LEAVE_GUILD_CID'),
        USER_LEVEL_CID: snowflake('USER_LEVEL_CID'),
        VOTE_CID: snowflake('VOTE_CID'),
        ERROR_CID: snowflake('ERROR_CID'),

        DASHBOARD: dashboard,
        STREAMS: streams,
        TRANSLATE_API_KEY: optional('GOOGLE_TRANSLATE_API_KEY'),
        TOPGG_WEBHOOK_SECRET: optional('TOPGG_WEBHOOK_SECRET'),
        TOPGG_TOKEN: optional('TOPGG_TOKEN'),
        BACKUPS: backups,
    };

    return errors.length > 0 ? { env: null, errors, warnings } : { env: parsed, errors, warnings };
}
