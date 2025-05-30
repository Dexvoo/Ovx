const { EmbedBuilder, MessageFlags } = require('discord.js')
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

    if (title.length > maxTitleLength) title = title.substring(0, maxTitleLength);
    

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
* @param {import('discord.js').Interaction} interaction 
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

module.exports = { consoleLog, consoleLogData, SendEmbed, ShortTimestamp };

