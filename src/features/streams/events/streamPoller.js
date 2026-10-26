import { Events } from 'discord.js';
import { startStreamPoller } from '../utils/poller.js';
import * as twitch from '../utils/platforms/twitch.js';
import * as kick from '../utils/platforms/kick.js';
import * as youtube from '../utils/platforms/youtube.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Stream Notifications';

/**
 * @param {import('discord.js').Client} client
 */
export function execute(client) {
    startStreamPoller(client);

    const on = [
        twitch.isConfigured() && 'Twitch',
        kick.isConfigured() && 'Kick',
        'YouTube videos',
        youtube.canDetectLive() && 'YouTube live',
    ];
    LogData('Streams', `Checking: ${on.filter(Boolean).join(', ')}`, 'info');
}
