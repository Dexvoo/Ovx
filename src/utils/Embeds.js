const { EmbedBuilder, Client, GuildMember } = require('discord.js');
const { DevGuildID, DisabledFeaturesChannelID } = process.env;


/**
 * @param {Client} client - The client object
 * @param {GuildMember} targetMember - The member to disable the feature for
 * @param {string} feature - The feature to disable
 * @param {string} reason - The reason for disabling the feature
 * @returns
 */
function DisabledFeatures(client, targetMember, feature, reason) {
    if(!client) throw new Error('No client provided.');
    if(!targetMember) throw new Error('No member provided.');
    if(!feature) throw new Error('No feature provided.');
    if(!reason) throw new Error('No reason provided.');

    if(targetMember instanceof GuildMember) throw new Error('Invalid member provided.');

    const DisabledFeaturesChannel = client.guilds.cache.get(DevGuildID).channels.cache.get(DisabledFeaturesChannelID);
    if (!DisabledFeaturesChannel) return;

    const Embed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(`${targetMember.guild.name} | ${feature} | ${reason}`);
    DisabledFeaturesChannel.send({ embeds: [Embed] });


    const DMEmbed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(`${feature} is now disabled | Guild: ${targetMember.guild.name} | Reason: ${reason}`);
    targetMember.send({ embeds: [DMEmbed] }).catch(() => { });
}


module.exports = { DisabledFeatures };