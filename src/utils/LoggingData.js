const { EmbedBuilder, MessageFlags, Interaction, ChatInputCommandInteraction, GuildBasedChannel, TextChannel } = require('discord.js')
const Global_Cache = require('../cache/Global')
require('dotenv').config()
const { CommandCID, JoinGuildCID, LeaveGuildCID, UserLevelCID, DevGuildID } = process.env
/**
 * @param {string} data - String to be logged to the console
 */
const consoleLog = data => {
    if (!data) throw new Error('No title provided');
    const maxLength = 195
    
    if (typeof data !== 'string') data = String(data)

    if (data.length > maxLength) data = data.substring(0, maxLength)

    const totalPadding = maxLength - data.length
    const paddingStart = Math.floor(totalPadding / 2)
    console.log(`|${data.padStart(data.length + paddingStart, '- ').padEnd(maxLength, ' -')}|`)
    
}

/**
 * @param {string} title - Title
 * @param {string} description - Description
 * @param {string} type - Type of message
 */
const consoleLogData = (title, description, type) => {
    if (!title) throw new Error('No title provided');
    if (!description) throw new Error('No description provided');
    if (!type) throw new Error('No type provided');
    const maxLength = 203
    
    if (typeof title !== 'string') title = String(title);
    if (typeof description !== 'string') description = String(description);
    if (typeof type !== 'string') type = String(type);

    const maxTitleLength = 20;
    title = title.padEnd(maxTitleLength).substring(0, maxTitleLength);
    

    const typeColors = {
        error: '\u001b[1;31m',
        success: '\u001b[1;32m',
        warning: '\u001b[1;33m',
        info: '\u001b[1;34m',
        debug: '\u001b[1;35m',
        default: '\u001b[1;37m'
    };
    
    const typeTitles = {
        error: '[E]',
        success: '[S]',
        warning: '[W]',
        info: '[I]',
        debug: '[D]',
        default: '[?]'
    };
    
    const color = typeColors[type] || typeColors.default;
    const titlePrefix = typeTitles[type] || typeTitles.default;
    title = `| ${color}${titlePrefix} | ${title}`;
    const data = `${title} | ${description}`.padEnd(maxLength, ' ') + '\u001b[0m|';
    console.log(data);
}


/**
* @param {Interaction | TextChannel } interaction 
* @param {Colors} colour
* @param {String} title 
* @param {String} description
* @param {Array} fields  
* @param {Boolean} ephemeral
*/
const SendEmbed = async (interaction, colour, title, description, fields = [], ephemeral = true) => {
    if (!interaction) throw new Error('No interaction provided.');
    if (!colour) throw new Error('No colour provided.');
    if (!title) throw new Error('No title provided.');
    if (!description) throw new Error('No description provided.');

    const embed = new EmbedBuilder()
        .setColor(colour)
        .setTitle(title)
        .setDescription(description);

    if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);

    if(interaction instanceof ChatInputCommandInteraction) {
        // Check if the channel exists and is accessible
        if (!interaction.channel) {
            // try to fetch the channel if it doesn't exist
            try {
                await interaction.guild.channels.fetch(interaction.channelId);
            } catch (error) {
                return console.error('Channel not found or inaccessible:', error);
            }
        }

        try {
            if (interaction.replied || interaction.deferred) {
                return await interaction.editReply({ embeds: [embed], flags: ephemeral ? [MessageFlags.Ephemeral] : undefined });
            } else {
                return await interaction.reply({ embeds: [embed], flags: ephemeral ? [MessageFlags.Ephemeral] : undefined });
            }
        } catch (error) {
            console.error('Failed to send embed:', error);
        }
    } else if (interaction instanceof TextChannel) {
            interaction.send({ embeds: [embed], flags: ephemeral ? [MessageFlags.Ephemeral] : undefined})
        
    }

    
}

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
 *
 * @example
 * // Example output assuming timestamp is 1624855717 (June 27, 2021 9:48 PM)
 * Timestamp(new Date(1624855717000), 'f') // => '<t:1624855717:f>' (short date time)
 * Timestamp(new Date(1624855717000), 'F') // => '<t:1624855717:F>' (long date time)
 * Timestamp(new Date(1624855717000), 'd') // => '<t:1624855717:d>' (short date)
 * Timestamp(new Date(1624855717000), 'D') // => '<t:1624855717:D>' (long date)
 * Timestamp(new Date(1624855717000), 't') // => '<t:1624855717:t>' (short time)
 * Timestamp(new Date(1624855717000), 'T') // => '<t:1624855717:T>' (long time)
 * Timestamp(new Date(1624855717000), 'R') // => '<t:1624855717:R>' (relative time)
 */

function Timestamp(date, type = 'R') {
    if (!date) throw new Error('No date provided.');
    if (!(date instanceof Date)) throw new Error('Provided date is not a valid Date object.');

    const timestamp = Math.floor(date.getTime() / 1000);
    return `<t:${timestamp}:${type}>`;
};




/**
 * Sends an embed log to the specified log channel based on the type of log.
 * @param {string} type - The type of log (e.g., 'command', 'joinGuild', 'leaveGuild', 'userLevel').
 * @param {ChatInputCommandInteraction} interaction - The interaction that triggered the log.
 * @param {EmbedBuilder} embed - The embed to send
*/

async function SendEmbedLog(type, interaction, embed) {
    if (!type) throw new Error('No type provided.');
    if (!interaction) throw new Error('No interaction provided.');
    if (!embed) throw new Error('No embed provided.');

    const typesOfLogs = {
        'command': CommandCID,
        'joinGuild': JoinGuildCID,
        'leaveGuild': LeaveGuildCID,
        'userLevel': UserLevelCID,
    };

    const currentLogChannel = typesOfLogs[type];
    if (!currentLogChannel) throw new Error(`No log channel found for type: ${type}`);

    try {
        await interaction.client.shard.broadcastEval(async (client, {embed, channelId, guildId}) => {

            const guild = client.guilds.cache.get(guildId);
            if (!guild) return console.error(`Guild with ID ${guildId} not found.`);

            const channel = guild.channels.cache.get(channelId);
            if (!channel) return;

            await channel.send({ embeds: [embed] });
        }, {
            context: {
                embed: embed,
                channelId: currentLogChannel,
                guildId: DevGuildID,
            },
            shard: Global_Cache.DevSID
        });
    } catch (error) {
        console.error(error);
    };
};


/**
 * @param {Number} n - Number
*/
function getOrdinalSuffix(n) {
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;
    if (lastDigit === 1 && lastTwoDigits !== 11) return 'st';
    if (lastDigit === 2 && lastTwoDigits !== 12) return 'nd';
    if (lastDigit === 3 && lastTwoDigits !== 13) return 'rd';
    return 'th';
}

module.exports = { consoleLog, consoleLogData, SendEmbed, SendEmbedLog, ShortTimestamp, Timestamp, getOrdinalSuffix };

