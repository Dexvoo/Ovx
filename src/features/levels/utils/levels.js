const XP_MINIMUM_TEXT_CHAT = 15;
const XP_MAXIMUM_TEXT_CHAT = 100;

const XP_MINIMUM_VOICE_CHAT = 15;
const XP_MAXIMUM_VOICE_CHAT = 40;

const COOLDOWN_VOICE_CHAT = 3; // Minutes

/**
 * @return {number} - A random amount of experience points for sending a message
 */

function MessageXP() {
    const min = Math.ceil(XP_MINIMUM_TEXT_CHAT);
    const max = Math.floor(XP_MAXIMUM_TEXT_CHAT);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * @param {Number} minutes - The amount of minutes the user has been in the voice channel
 * @return {number} - A random amount of experience points for being in a voice channel
 */

function VoiceXP(minutes) {
    const min = Math.ceil(XP_MINIMUM_VOICE_CHAT);
    const max = Math.floor(XP_MAXIMUM_VOICE_CHAT);
    return Math.floor((Math.floor(Math.random() * (max - min + 1) + min) * minutes) / COOLDOWN_VOICE_CHAT);
}

/**
 * @param {Number} level - The level
 * @return {number} - The amount of experience points required to reach the level
 */

function ExpForLevel(level) {
    if (level <= 0) return 0; // No XP required for level 0 or below
    return 50 * Math.pow(level, 2) + 25 * level;
}

/**
 * @param {number} exp - Total cumulative XP
 * @returns {[number, number, number]} - [level, currentXPInLevel, xpForNextLevel]
 */
function LevelForExp(exp) {
    if (exp <= 0) return [0, 0, ExpForLevel(1)];

    let level = 0;

    while (exp >= ExpForLevel(level + 1)) {
        level++;
    }

    const xpForCurrentLevel = ExpForLevel(level);
    const xpIntoCurrentLevel = exp - xpForCurrentLevel;
    const xpForNextLevel = ExpForLevel(level + 1) - xpForCurrentLevel;

    return [level, xpIntoCurrentLevel, xpForNextLevel];
}

/**
 * @param {number} current - Current XP into level
 * @param {number} required - XP needed for next level
 * @returns {string} - e.g. "34 / 125 (27%)"
 */
function progressBar(current, required) {
    const percent = ((current / required) * 100).toFixed(1);
    return `${current} / ${required} (${percent}%)`;
}

export { MessageXP, VoiceXP, ExpForLevel, LevelForExp, progressBar };
