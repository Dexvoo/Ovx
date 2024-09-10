const { Events, EmbedBuilder, Message, PermissionFlagsBits } = require('discord.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs');
const { permissionCheck } = require('../../utils/Checks');

module.exports = {
    name: Events.MessageDelete,
    once: false,
    nickname: 'Message Delete',

    /**
     * 
     */

    async execute(message) {
        const { client, guild, member, channel, content, author } = message;
        
    }
}