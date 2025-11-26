/**
 * @enum {string}
 */
const CooldownType = {
  Message: 'message',
  Command: 'command',
  Reaction: 'reaction',
  Voice: 'voice',
  Daily: 'daily',
};

class CooldownManager {
  constructor() {
    /** @type {Map<string, number>} */
    this.cooldowns = new Map();
  }

  /**
   * Generate a unique key for each cooldown scope
   * @param {keyof typeof CooldownType} type
   * @param {string} userId
   * @param {string} [identifier] - Optional command name or extra context
   * @returns {string}
   */
  _getKey(type, userId, identifier = '') {
    return `${type}:${identifier}:${userId}`;
  }

  /**
   * Add a cooldown
   * @param {keyof typeof CooldownType} type
   * @param {string} userId
   * @param {number} duration - in seconds
   * @param {string} [identifier]
   */
  add(type, userId, duration = 60, identifier = '') {
    const key = this._getKey(type, userId, identifier);
    const expiresAt = new Date(Date.now() + duration * 1000);
    this.cooldowns.set(key, expiresAt);
    setTimeout(() => this.cooldowns.delete(key), duration * 1000);
  }

  /**
   * Check if a cooldown exists
   * @param {keyof typeof CooldownType} type
   * @param {string} userId
   * @param {string} [identifier]
   * @returns {boolean}
   */
  has(type, userId, identifier = '') {
    const key = this._getKey(type, userId, identifier);
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get time left in seconds
   * @param {keyof typeof CooldownType} type
   * @param {string} userId
   * @param {string} [identifier]
   * @returns {Date|null}
   */
  getRemaining(type, userId, identifier = '') {
    const key = this._getKey(type, userId, identifier);
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return null;

    return expiresAt;
  }

  /**
   * Remove a cooldown
   * @param {keyof typeof CooldownType} type
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
}

module.exports = { CooldownManager, CooldownType };
