import { Events } from 'discord.js';
import User_Level_Cache from '../cache/userLevels.cache.js';
import Guild_Level_Cache from '../cache/guildLevels.cache.js';
import { ValidateXP } from '../utils/validation.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'User Voice XP';

const TICK_INTERVAL_MS = 60_000;
// Members in a channel with fewer eligible humans than this earn nothing (stops solo AFK farming)
const MIN_ELIGIBLE_MEMBERS = 2;

let ticking = false;

/**
 * Starts a once-a-minute tick that awards voice XP to everyone currently eligible.
 * Reading live voice states (instead of tracking join/leave sessions) means members already
 * in voice when the bot starts are counted, and a crash loses at most one minute.
 *
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param { Client } client
 */
export async function execute(client) {
    setInterval(async () => {
        // Skip if the previous tick is still running (e.g. slow database)
        if (ticking) return;
        ticking = true;

        try {
            await awardVoiceXP(client);
        } catch (error) {
            client.utils.LogData('Voice XP', `Tick failed: ${error.stack ?? error.message}`, 'error');
        } finally {
            ticking = false;
        }
    }, TICK_INTERVAL_MS);
}

/**
 * @param { Client } client
 */
async function awardVoiceXP(client) {
    for (const guild of client.guilds.cache.values()) {
        if (guild.voiceStates.cache.size === 0) continue;

        try {
            // Cheap per-guild check before validating each member
            const guildConfig = await Guild_Level_Cache.get(guild.id);
            if (!guildConfig.enabled || !guildConfig.channelId) continue;

            /** @type {Map<string, import('discord.js').VoiceState[]>} */
            const eligibleByChannel = new Map();
            for (const state of guild.voiceStates.cache.values()) {
                if (!isEligible(state)) continue;

                const states = eligibleByChannel.get(state.channelId) ?? [];
                states.push(state);
                eligibleByChannel.set(state.channelId, states);
            }

            for (const states of eligibleByChannel.values()) {
                if (states.length < MIN_ELIGIBLE_MEMBERS) continue;

                for (const state of states) {
                    const validate = await ValidateXP(state.member, state.channel);
                    if (!validate) continue;

                    await User_Level_Cache.addVoiceXP(state.member, validate.guildConfig, 1);
                }
            }
        } catch (error) {
            client.utils.LogData('Voice XP', `Guild: ${guild.name} | ${error.message}`, 'error');
        }
    }
}

/**
 * A member earns voice XP if they are a human in a non-AFK channel and not deafened.
 * @param { import('discord.js').VoiceState } state
 * @returns { boolean }
 */
function isEligible(state) {
    if (!state.channelId || !state.member || state.member.user.bot) return false;
    if (state.channelId === state.guild.afkChannelId) return false;
    if (state.deaf) return false; // self or server deafened

    return true;
}
