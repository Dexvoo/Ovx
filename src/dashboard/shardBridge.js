import { ShardClientUtil } from 'discord.js';

/**
 * Lets the dashboard (running in the ShardingManager process) run actions on shards.
 * Guild actions go to the one shard that owns the guild; the rest go to every shard.
 *
 * @param {import('discord.js').ShardingManager} manager
 */
export function createShardBridge(manager) {
    /**
     * @param {string} action
     * @param {object} payload
     * @param {number} [shard] - Omit to run on every shard
     * @returns {Promise<any>} One result when shard is given, otherwise an array (one per shard)
     */
    const run = (action, payload, shard) =>
        manager.broadcastEval((client, { action, payload }) => client.dashboard(action, payload), {
            context: { action, payload },
            shard,
        });

    /** @param {string} guildId */
    const shardFor = (guildId) =>
        ShardClientUtil.shardIdForGuildId(guildId, /** @type {number} */ (manager.totalShards));

    return {
        /**
         * Runs an action on the shard that owns guildId.
         * @param {string} action
         * @param {string} guildId - Must already be a valid snowflake
         * @param {object} [payload]
         * @returns {Promise<{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }>}
         */
        guild: (action, guildId, payload = {}) => run(action, { ...payload, guildId }, shardFor(guildId)),

        /**
         * Which of these guilds the bot is in.
         * @param {string[]} guildIds
         * @returns {Promise<Set<string>>}
         */
        async botGuildIds(guildIds) {
            const results = await run('botGuilds', { guildIds });
            return new Set(results.flatMap((result) => (result.ok ? result.data : [])));
        },

        /**
         * Posts a Top.gg vote to the developer vote log. Any shard can post it, so the first one does.
         * @param {string} userId
         * @param {number} votes - Their total
         */
        logVote: (userId, votes) => run('logVote', { userId, votes }, 0),

        /**
         * Tells every shard someone voted, so their vote rewards start at once.
         * @param {string} userId
         */
        voteReceived: (userId) => run('voteReceived', { userId }),

        /**
         * Each shard's state, asked one at a time with a time limit, so a shard that's down shows as down
         * instead of making the whole check fail (as one broadcast to every shard would).
         * @param {number} [timeoutMs]
         * @returns {Promise<{ id: number, status: 'online' | 'reconnecting' | 'down', ping: number | null }[]>}
         */
        async health(timeoutMs = 5000) {
            const total = Number(manager.totalShards) || manager.shards.size;
            const results = [];
            for (let id = 0; id < total; id++) {
                const shard = manager.shards.get(id);
                if (!shard?.ready) {
                    results.push({ id, status: 'down', ping: null });
                    continue;
                }
                const state = await Promise.race([
                    shard.eval((client) => ({ ready: client.ws.status === 0, ping: client.ws.ping })),
                    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs).unref()),
                ]).catch(() => null);
                results.push(
                    state
                        ? {
                              id,
                              status: state.ready ? 'online' : 'reconnecting',
                              ping: Math.max(0, Math.round(state.ping)),
                          }
                        : { id, status: 'down', ping: null }
                );
            }
            return results;
        },

        /**
         * Stats from every shard, ordered by shard ID.
         * @returns {Promise<any[]>}
         */
        async stats() {
            const results = await run('stats', {});
            return results.filter((result) => result.ok).map((result) => result.data);
        },
    };
}
