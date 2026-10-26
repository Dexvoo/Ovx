/**
 * Sets valid placeholder environment variables so modules that import the environment can load
 * without a .env file. Call before dynamically importing those modules.
 * @param {Record<string, string>} [overrides]
 */
export function stubEnvironment(overrides = {}) {
    // Assigned (not ??=) so a local .env can't switch the tests into developer mode
    process.env.DEVELOPER_MODE = 'false';
    process.env.MONGO_URI ??= 'mongodb://localhost/test';
    process.env.BOT_TOKEN ??= 'test-token';
    process.env.BOT_APPLICATION_ID ??= '100000000000000000';
    process.env.DEFAULT_LANGUAGE = 'en-GB';
    // Stream platforms and translation start switched off, so real keys in a local .env never reach their APIs
    for (const key of [
        'TWITCH_CLIENT_ID',
        'TWITCH_CLIENT_SECRET',
        'KICK_CLIENT_ID',
        'KICK_CLIENT_SECRET',
        'YOUTUBE_API_KEY',
        'GOOGLE_TRANSLATE_API_KEY',
        'TOPGG_WEBHOOK_SECRET',
        'TOPGG_TOKEN',
        'BACKUP_CID',
    ]) {
        process.env[key] = '';
    }
    Object.assign(process.env, overrides);
}
