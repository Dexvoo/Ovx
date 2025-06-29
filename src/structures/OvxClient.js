const { Client } = require('discord.js');
const ConsoleLogs = require('../utils/Functions/ConsoleLogs');
const Embeds = require('../utils/Functions/Embeds');
const Permissions = require('../utils/Functions/Permissions');
const Timestamps = require('../utils/Functions/Timestamps');
const customEmojis = require('../utils/Classes/CustomEmojis.json')

class OvxClient extends Client {
    constructor(options) {
        super(options);

        /**
         * @type {{
         *  Log: typeof ConsoleLogs.Log,
         *  LogData: typeof ConsoleLogs.LogData,
         *  Embed: typeof Embeds.Embed,
         *  EmbedDev: typeof Embeds.EmbedDev,
         *  PermCheck: typeof Permissions.PermCheck,
         *  DevCheck: typeof Permissions.DevCheck,
         *  HasVotedTGG: typeof Permissions.HasVotedTGG,
         *  Timestamp: typeof Timestamps.Timestamp,
         * 
         * 
         * }}
         */
        this.utils = {
            ...ConsoleLogs,
            ...Embeds,
            ...Permissions, 
            ...Timestamps
        };

        this.CustomEmojis = customEmojis;
    }
}

module.exports = OvxClient;