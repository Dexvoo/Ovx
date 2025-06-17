const XP_MINIMUM_TEXT_CHAT = 15;
const XP_MAXIMUM_TEXT_CHAT = 100; 

const XP_MINIMUM_VOICE_CHAT = 15; 
const XP_MAXIMUM_VOICE_CHAT = 40; 

const COOLDOWN_TEXT_CHAT = 0.5; // Minutes
const COOLDOWN_VOICE_CHAT = 3; // Minutes


/**
* @returns {Number} - A random amount of experience points for sending a message
*/

function MessageXP() {
    const min = Math.ceil(XP_MINIMUM_TEXT_CHAT);
    const max = Math.floor(XP_MAXIMUM_TEXT_CHAT);
    return Math.floor(Math.random() * (max - min + 1) + min);
}


/**
* @param {Number} minutes - The amount of minutes the user has been in the voice channel
* @returns {Number} - A random amount of experience points for being in a voice channel
*/

function VoiceXP(minutes) {
    const min = Math.ceil(XP_MINIMUM_VOICE_CHAT);
    const max = Math.floor(XP_MAXIMUM_VOICE_CHAT);
    return Math.floor((Math.floor(Math.random() * (max - min + 1) + min) * minutes) / COOLDOWN_VOICE_CHAT);
}


/**
 * @param {Number} level - The level
 * @returns {Number} - The amount of experience points required to reach the level
*/

function ExpForLevel(level) {
    if (level <= 0) return 0; // No XP required for level 0 or below
    return 50 * Math.pow(level, 2) + 25 * level;
}


/**
* @param {Number} exp - The amount of experience points
* @returns {[Number, Number]} - A tuple containing the level and the amount of experience points left over
*/

function LevelForExp(exp) {
    if (exp <= 0) return [0, 0]; // Level 0 for 0 XP
    
    let level = 0;
    let xpLeftOver = exp;

    while (xpLeftOver >= ExpForLevel(level + 1)) {
        level++;
    }

    xpLeftOver -= ExpForLevel(level);

    return [level, xpLeftOver];
}


module.exports = { MessageXP, VoiceXP, ExpForLevel, LevelForExp };
