import { Events } from 'discord.js';
import { handleVoiceChange } from '../utils/channels.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.VoiceStateUpdate;
export const once = false;
export const description = 'Temp Voice: Join to Create';

/**
 * @param {import('discord.js').VoiceState} before
 * @param {import('discord.js').VoiceState} after
 */
export async function execute(before, after) {
    await handleVoiceChange(before, after).catch((error) =>
        LogData('Temp Voice', `Guild: ${after.guild.name} | ${error.message}`, 'warning')
    );
}
