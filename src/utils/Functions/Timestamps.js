const { EmbedBuilder, MessageFlags, Interaction, ChatInputCommandInteraction, GuildBasedChannel, TextChannel, Message, Client, TextDisplayBuilder, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, Colors, MessageMentions } = require('discord.js')
const Global_Cache = require('../../cache/Global')
require('dotenv').config()
const { CommandCID, JoinGuildCID, LeaveGuildCID, UserLevelCID, DevGuildID } = process.env;

/**
* @param {Number} timestamp
* @returns {String} - Short timestamp
*/
const ShortTimestamp = timestamp => {
    if (!timestamp) throw new Error('No timestamp provided.');
    const date = new Date(timestamp);
    return `<t:${Math.round(date / 1000)}:R>`
}


/**
 * Generates a Discord-formatted timestamp.
 *
 * @param {Date} date - Date object
 * @param {'f' | 'F' | 'd' | 'D' | 't' | 'T' | 'R'} [type='R'] - Discord timestamp format 
 * @returns {string} Formatted Discord timestamp string
 */

function Timestamp(date, type = 'R') {
    if (!date) throw new Error('No date provided.');
    if (!(date instanceof Date)) throw new Error('Provided date is not a valid Date object.');

    const timestamp = Math.floor(date.getTime() / 1000);
    return `<t:${timestamp}:${type}>`;
};

module.exports = { ShortTimestamp, Timestamp };

