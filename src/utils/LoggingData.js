const { EmbedBuilder } = require('discord.js')
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
* @param {CommandInteraction} interaction 
* @param {Colors} colour
* @param {String} title 
* @param {String} description
* @param {Array} fields  
*/
const SendEmbed = (interaction, colour, title, description, fields = []) => {
    if (!interaction) throw new Error('No interaction provided.');
    if (!colour) throw new Error('No colour provided.');
    if (!title) throw new Error('No title provided.');
    if (!description) throw new Error('No description provided.');

    const embed = new EmbedBuilder()
        .setColor(colour)
        .setTitle(title)
        .setDescription(description)
        .addFields(fields);

    return interaction.editReply({ embeds: [embed] });
}

module.exports = { consoleLog, consoleLogData, SendEmbed };

