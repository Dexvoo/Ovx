/**
 * @readonly
 * @enum {string}
 */
export const CooldownType = Object.freeze({
    Message: 'message',
    Command: 'command',
    Reaction: 'reaction',
    Voice: 'voice',
    Daily: 'daily',
});

export class CooldownManager {
    /**
     * @param {number} [sweepIntervalMs=0] - How often to remove expired cooldowns. Expired entries are
     * otherwise only removed when the same cooldown is checked again, so without sweeping the map
     * keeps one entry for every user that ever triggered a cooldown. 0 disables sweeping.
     */
    constructor(sweepIntervalMs = 0) {
        /**
         * Stores cooldown expiration timestamps
         * @type {Map<string, number>}
         */
        this.cooldowns = new Map();

        if (sweepIntervalMs > 0) {
            // unref so the sweep timer never keeps the process alive on its own
            setInterval(() => this.cleanup(), sweepIntervalMs).unref();
        }
    }

    /**
     * Generates a unique cooldown key
     *
     * @param {typeof CooldownType[keyof typeof CooldownType]} type
     * @param {string} userId
     * @param {string} [identifier]
     * @returns {string}
     */
    _getKey(type, userId, identifier = '') {
        return `${type}:${identifier}:${userId}`;
    }

    /**
     * Add a cooldown
     *
     * @param {typeof CooldownType[keyof typeof CooldownType]} type
     * @param {string} userId
     * @param {number} duration Duration in seconds
     * @param {string} [identifier]
     */
    add(type, userId, duration = 60, identifier = '') {
        const key = this._getKey(type, userId, identifier);
        this.cooldowns.set(key, Date.now() + duration * 1000);
    }

    /**
     * Get cooldown expiration timestamp
     *
     * Returns:
     * - null if cooldown expired / doesn't exist
     * - expiration timestamp in milliseconds if active
     *
     * @param {typeof CooldownType[keyof typeof CooldownType]} type
     * @param {string} userId
     * @param {string} [identifier]
     * @returns {number|null}
     */
    getRemaining(type, userId, identifier = '') {
        const key = this._getKey(type, userId, identifier);
        const expiresAt = this.cooldowns.get(key);

        if (!expiresAt) {
            return null;
        }

        if (Date.now() >= expiresAt) {
            this.cooldowns.delete(key);
            return null;
        }

        return expiresAt;
    }

    /**
     * Check if a cooldown exists
     *
     * @param {typeof CooldownType[keyof typeof CooldownType]} type
     * @param {string} userId
     * @param {string} [identifier]
     * @returns {boolean}
     */
    has(type, userId, identifier = '') {
        return this.getRemaining(type, userId, identifier) !== null;
    }

    /**
     * Remove a cooldown
     *
     * @param {typeof CooldownType[keyof typeof CooldownType]} type
     * @param {string} userId
     * @param {string} [identifier]
     */
    remove(type, userId, identifier = '') {
        this.cooldowns.delete(this._getKey(type, userId, identifier));
    }

    /**
     * Clear all cooldowns
     */
    clear() {
        this.cooldowns.clear();
    }

    /**
     * Cleanup expired cooldowns
     * Useful for occasional sweeping
     */
    cleanup() {
        const now = Date.now();

        for (const [key, expiresAt] of this.cooldowns) {
            if (now >= expiresAt) {
                this.cooldowns.delete(key);
            }
        }
    }
}
