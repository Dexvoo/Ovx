const { EmbedBuilder, MessageFlags, Interaction, ChatInputCommandInteraction, GuildBasedChannel, TextChannel, Message, Client, TextDisplayBuilder, ContainerBuilder, SeparatorBuilder, Colors, BaseInteraction, RESTJSONErrorCodes, DiscordAPIError, GuildMember, User } = require('discord.js')
const Global_Cache = require('../../cache/Global')
require('dotenv').config()
const { CommandCID, JoinGuildCID, LeaveGuildCID, UserLevelCID, DevGuildID } = process.env

/**
 * A robust utility to create and send an embed.
 * Can send to a TextChannel, DM a User/GuildMember, or reply to an Interaction.
 *
 * @param {BaseInteraction | TextChannel | User | GuildMember} target The interaction, channel, user, or member to send the embed to.
 * @param {Colors} color The color of the embed's side strip.
 * @param {string} title The title of the embed.
 * @param {string} description The main text of the embed.
 * @param {object} [options={}] Optional parameters.
 * @param {import('discord.js').APIEmbedField[]} [options.fields=[]] An array of embed fields.
 * @param {boolean} [options.ephemeral=true] Whether the reply should be ephemeral (for interactions ONLY).
 * @returns {Promise<Message|null>} The sent message, or null if sending failed.
 */
async function Embed(target, color, title, description, { fields = [], ephemeral = true } = {}) {
    if (!target) {
        console.error('Embed Util Error: No target (interaction, channel, or user) was provided.');
        return null;
    }
    if (!color || !title || !description) {
        console.error('Embed Util Error: Missing one of required parameters: color, title, or description.');
        return null;
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description);

    if (Array.isArray(fields) && fields.length > 0) {
        embed.setFields(fields);
    }

    try {
        if (target instanceof BaseInteraction) {
            if (target.replied || target.deferred) {
                return await target.editReply({ embeds: [embed], components: [] });
            } else {
                return await target.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral = ephemeral] });
            }
        }
        else if (target instanceof User || target instanceof GuildMember) {
            return await target.send({ embeds: [embed] });
        }
        else if (target instanceof TextChannel) {
            return await target.send({ embeds: [embed] });
        }
        else {
            console.error(`Embed Util Error: Unsupported target type provided: ${target.constructor.name}`);
            return null;
        }
    } catch (error) {
        if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
            console.error(`Embed Util Error: Failed to send DM to user ${target.id}. They may have DMs disabled or have the bot blocked.`);
        } else {
            console.error(`Embed Util Error: Failed to send embed to target '${target.id}':`, error);
        }
        return null;
    }
};



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
        .setContent(`${description.substring(0, 1000)}`);
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
 * @param {'command' | 'joinGuild' | 'leaveGuild' | 'userLevel' } type - types of logs
 * @param {Client} client - discord client
 * @param {EmbedBuilder} embed - The embed to send
*/

async function EmbedDev(type, client, embed) {
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

module.exports = { SendEmbed, EmbedDev, Embed };

