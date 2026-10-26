import { Client, Collection } from 'discord.js';
import emojis from '../shared/constants/emojis.json' with { type: 'json' };
import * as Embeds from '../shared/utils/embed.js';
import * as ConsoleLogs from '../shared/utils/logger.js';
import * as Timestamps from '../shared/utils/timestamps.js';
import * as Permissions from '../shared/utils/permissions.js';
import * as I18n from '../shared/utils/i18n.js';
import * as MathUtils from '../shared/utils/math.js';
import * as StringUtils from '../shared/utils/string.js';
import { CooldownManager } from '../shared/cache/cooldowns.js';
import { reloadCommand } from './baseCommands.js';

class ModifiedClient extends Client {
    constructor(options) {
        super(options);

        /**
         * @type {{
         *  Log: typeof ConsoleLogs.Log,
         *  LogData: typeof ConsoleLogs.LogData,
         *  Embed: typeof Embeds.Embed,
         *  DevEmbed: typeof Embeds.DevEmbed,
         *  Timestamp: typeof Timestamps.Timestamp,
         *  ShortTimestamp: typeof Timestamps.ShortTimestamp,
         *  PermissionCheck: typeof Permissions.PermissionCheck,
         *  DevPermissionCheck: typeof Permissions.DevPermissionCheck,
         *  Translate: typeof I18n.Translate,
         *  GetOrdinalSuffix: typeof MathUtils.GetOrdinalSuffix,
         *  Truncate: typeof StringUtils.Truncate
         * }}
         */

        this.utils = {
            ...ConsoleLogs,
            ...Embeds,
            ...Timestamps,
            ...Permissions,
            ...I18n,
            ...MathUtils,
            ...StringUtils,
        };

        this.customEmojis = emojis;

        /**
         * Loaded slash commands, keyed by name.
         * @type {Collection<string, import('./baseCommands.js').Command>}
         */
        this.commands = new Collection();

        /**
         * Global cooldown manager.
         * Used for commands, message XP, reactions, dailies, etc.
         * Expired entries are swept every 5 minutes so memory doesn't grow with every user seen.
         * @type {CooldownManager}
         */
        this.cooldowns = new CooldownManager(5 * 60_000);
    }

    /**
     * Reloads a command from disk on this shard. Exposed on the client so
     * broadcastEval can call it on every shard.
     * @param {string} commandName
     * @returns {Promise<string>} The reloaded command's name
     */
    reloadCommand(commandName) {
        return reloadCommand(this, commandName);
    }

    /**
     * Runs a dashboard action on this shard. Called by the dashboard server (in the manager
     * process) through broadcastEval. Loaded lazily so shards only load it when it's used.
     * @param {string} action
     * @param {any} payload
     * @returns {Promise<any>}
     */
    async dashboard(action, payload) {
        const { handle } = await import('../dashboard/shardHandlers.js');
        return handle(this, action, payload);
    }

    /**
     * Drops this shard's cached copy of a guild's settings (called on every shard when premium changes).
     * @param {string} guildId
     */
    async invalidateGuildSettings(guildId) {
        const { default: cache } = await import('../shared/cache/guildSettings.cache.js');
        cache.invalidate(guildId);
    }
}

export default ModifiedClient;
