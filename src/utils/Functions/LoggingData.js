const { EmbedBuilder, MessageFlags, Interaction, ChatInputCommandInteraction, GuildBasedChannel, TextChannel, Message, Client, TextDisplayBuilder, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, Colors, MessageMentions } = require('discord.js')
const Global_Cache = require('../../cache/Global')
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

const typeTitles = {
        error: '[E]',
        success: '[S]',
        warning: '[W]',
        info: '[I]',
        debug: '[D]',
        default: '[?]'
    };

/**
 * @param {string} title - Title
 * @param {string} description - Description
 * @param {'error' | 'success' | 'warning' | 'info' | 'debug' | 'default'} [type='default'] - Styles of logging
 */
const consoleLogData = (title, description, type ) => {
    if (!title) throw new Error('No title provided');
    if (!description) throw new Error('No description provided');
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
const SendEmbedv1 = async (interaction, colour, title, description, fields = [], ephemeral = true) => {
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

    const containerComponent = new ContainerBuilder()

    const textComponentTitle = new TextDisplayBuilder()
        .setContent(`# ${title}`);
    containerComponent.addTextDisplayComponents(textComponentTitle);

    const separatorComponent = new SeparatorBuilder()
        .setDivider(true)
    containerComponent.addSeparatorComponents(separatorComponent);

    const textComponentDescription = new TextDisplayBuilder()
        .setContent(`${description}`);
    containerComponent.addTextDisplayComponents(textComponentDescription);
    containerComponent.setSpoiler(true)

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
                return await interaction.editReply({ flags: [MessageFlags.IsComponentsV2], components: [containerComponent], allowedMentions: { parse: [] } });
            } else {
                return await interaction.reply({ flags: [MessageFlags.IsComponentsV2], components: [containerComponent], allowedMentions: { parse: [] } });
            }
        } catch (error) {
            console.error('Failed to send embed:', error);
        }
    } else if (interaction instanceof TextChannel) {
            interaction.send({ flags: [MessageFlags.IsComponentsV2, ephemeral ? MessageFlags.Ephemeral : null], components: [containerComponent], allowedMentions: { parse: [] } })
        
    }

    
}




/**
 * Sends an embed log to the specified log channel based on the type of log.
 * @param {'command' | 'joinGuild' | 'leaveGuild' | 'userLevel' } type - Discord timestamp format 
 * @param {Client} client - discord client
 * @param {EmbedBuilder} embed - The embed to send
*/

async function SendEmbedLog(type, client, embed) {
    if (!type) throw new Error('No type provided.');
    if (!client) throw new Error('No interaction provided.');
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
        await client.shard.broadcastEval(async (shardClient, {embed, channelId, guildId}) => {

            const guild = shardClient.guilds.cache.get(guildId);
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

module.exports = { consoleLog, consoleLogData, SendEmbed, SendEmbedLog, getOrdinalSuffix };

