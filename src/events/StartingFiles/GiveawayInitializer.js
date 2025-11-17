const { Events, Client } = require('discord.js');
const { start } = require('../../handlers/Giveaways/GiveawayManager');

module.exports = {
    name: Events.ClientReady,
    once: true,
    nickname: 'Giveaway Initializer',

    /**
     * @param {Client} client
     */
    async execute(client) {
        // Only run the manager on the first shard to avoid duplicate processing
        if (client.shard?.ids[0] === 0) {
            start(client);
            client.utils.LogData('GiveawayManager', 'Giveaway checking interval has been started.', 'success');
        }
    }
};