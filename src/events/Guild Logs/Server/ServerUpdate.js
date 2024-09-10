// const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent, Guild } = require('discord.js');
// const { ServerLogs } = require('../../../models/GuildSetups');
// const { permissionCheck } = require('../../../utils/Checks');
// const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
// const { DisabledFeatures } = require('../../../utils/Embeds');

// module.exports = {
//     name: Events.GuildUpdate,
//     once: false,
//     nickname: 'Server Update Logs',

//     /**
//      * @param {Guild} oldGuild
//      * @param {Guild} newGuild
//      */

//     async execute(oldGuild, newGuild) {
//         const { client } = newGuild;
//         console.log('Server Updated');

//         const guildServerLogs = await ServerLogs.findOne({ guildId: newGuild.id });

//         if(!guildServerLogs || !guildServerLogs.channelId || !guildServerLogs.enabled) return cleanConsoleLogData('Server Updated', `Guild: ${guild.name} | Disabled`, 'warning');

//         const targetChannel = newGuild.channels.cache.get(guildServerLogs.channelId);
        
//         if(!targetChannel) {
            
//             guildServerLogs.enabled = false;
//             await guildServerLogs.save().catch(() => { });
            
//             const guildOwner = await newGuild.fetchOwner();
//             return DisabledFeatures(client, guildOwner, 'Server Logs', `Channel not found`);
//         }

//         const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
//         const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

//         if(!hasPermission) {

//             guildServerLogs.enabled = false;
//             await guildServerLogs.save().catch(() => { });
            
//             const guildOwner = await newGuild.fetchOwner();
//             return DisabledFeatures(client, guildOwner, 'Server Logs', `Missing Permissions: \`${missingPermissions}\``);
//         }

//         const fetchedLogs = await newGuild.fetchAuditLogs(
//             { limit: 1, type: AuditLogEvent.GuildUpdate }
//         ).catch(() => { return false });

//         const updateLog = fetchedLogs?.entries?.first();
//         let executor = updateLog ? updateLog.executor : null;

//         if(!newGuild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';
//         const description = [];

//         if(oldGuild.name !== newGuild.name) {
//             description.push(`Server Name: ${oldGuild.name} => ${newGuild.name}`);
//         }

//         if(oldGuild.iconURL() !== newGuild.iconURL()) {
//             description.push(`Server Icon: [Old](${oldGuild.iconURL()}) => [New](${newGuild.iconURL()})`);
//         }

//         if(oldGuild.splashURL() !== newGuild.splashURL()) {
//             description.push(`Server Splash: [Old](${oldGuild.splashURL()}) => [New](${newGuild.splashURL()})`);
//         }

//         if(oldGuild.bannerURL() !== newGuild.bannerURL()) {
//             description.push(`Server Banner: [Old](${oldGuild.bannerURL()}) => [New](${newGuild.bannerURL()})`);
//         }

//         if(oldGuild.description !== newGuild.description) {
//             description.push(`Server Description: ${oldGuild.description} => ${newGuild.description}`);
//         }

//         if(oldGuild.ownerId !== newGuild.ownerId) {
//             description.push(`Server Owner: ${oldGuild.owner.user.tag} => ${newGuild.owner.user.tag}`);
//         }

//         if(oldGuild.afkChannelId !== newGuild.afkChannelId) {
//             description.push(`AFK Channel: ${oldGuild.afkChannel} => ${newGuild.afkChannel}`);
//         }

//         if(oldGuild.afkTimeout !== newGuild.afkTimeout) {
//             description.push(`AFK Timeout: ${oldGuild.afkTimeout} => ${newGuild.afkTimeout}`);
//         }

//         if(oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
//             description.push(`Explicit Content Filter: ${oldGuild.explicitContentFilter} => ${newGuild.explicitContentFilter}`);
//         }

//         if(oldGuild.verificationLevel !== newGuild.verificationLevel) {
//             description.push(`Verification Level: ${oldGuild.verificationLevel} => ${newGuild.verificationLevel}`);
//         }

//         if(oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
//             description.push(`Default Message Notifications: ${oldGuild.defaultMessageNotifications} => ${newGuild.defaultMessageNotifications}`);
//         }

//         if(oldGuild.mfaLevel !== newGuild.mfaLevel) {
//             description.push(`MFA Level: ${oldGuild.mfaLevel} => ${newGuild.mfaLevel}`);
//         }

//         if(oldGuild.systemChannelId !== newGuild.systemChannelId) {
//             description.push(`System Channel: ${oldGuild.systemChannel} => ${newGuild.systemChannel}`);
//         }

//         if(oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
//             description.push(`Premium Subscription Count: ${oldGuild.premiumSubscriptionCount} => ${newGuild.premiumSubscriptionCount}`);
//         }

//         if(oldGuild.premiumTier !== newGuild.premiumTier) {
//             description.push(`Premium Tier: ${oldGuild.premiumTier} => ${newGuild.premiumTier}`);
//         }

//         if(oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
//             description.push(`Vanity URL Code: ${oldGuild.vanityURLCode} => ${newGuild.vanityURLCode}`);
//         }

//         if(oldGuild.preferredLocale !== newGuild.preferredLocale) {
//             description.push(`Preferred Locale: ${oldGuild.preferredLocale} => ${newGuild.preferredLocale}`);
//         }

//         if(oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
//             description.push(`Rules Channel: ${oldGuild.rulesChannel} => ${newGuild.rulesChannel}`);
//         }

//         if(oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
//             description.push(`Public Updates Channel: ${oldGuild.publicUpdatesChannel} => ${newGuild.publicUpdatesChannel}`);
//         }

//         if(oldGuild.features !== newGuild.features) {
//             description.push(`Features: ${oldGuild.features} => ${newGuild.features}`);
//         }

//         if(oldGuild.maxPresences !== newGuild.maxPresences) {
//             description.push(`Max Presences: ${oldGuild.maxPresences} => ${newGuild.maxPresences}`);
//         }

//         if(oldGuild.maxMembers !== newGuild.maxMembers) {
//             description.push(`Max Members: ${oldGuild.maxMembers} => ${newGuild.maxMembers}`);
//         }

//         if(oldGuild.maxVideoChannelUsers !== newGuild.maxVideoChannelUsers) {
//             description.push(`Max Video Channel Users: ${oldGuild.maxVideoChannelUsers} => ${newGuild.maxVideoChannelUsers}`);
//         }

//         if(oldGuild.approximateMemberCount !== newGuild.approximateMemberCount) {
//             description.push(`Approximate Member Count: ${oldGuild.approximateMemberCount} => ${newGuild.approximateMemberCount}`);
//         }

//         if(oldGuild.approximatePresenceCount !== newGuild.approximatePresenceCount) {
//             description.push(`Approximate Presence Count: ${oldGuild.approximatePresenceCount} => ${newGuild.approximatePresenceCount}`);
//         }

//         if(oldGuild.banner !== newGuild.banner) {
//             description.push(`Banner: ${oldGuild.banner} => ${newGuild.banner}`);
//         }

//         if(oldGuild.discoverySplash !== newGuild.discoverySplash) {
//             description.push(`Discovery Splash: ${oldGuild.discoverySplash} => ${newGuild.discoverySplash}`);
//         }

//         if(oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
//             description.push(`Public Updates Channel: ${oldGuild.publicUpdatesChannel} => ${newGuild.publicUpdatesChannel}`);
//         }

//         if(oldGuild.systemChannelFlags !== newGuild.systemChannelFlags) {
//             description.push(`System Channel Flags: ${oldGuild.systemChannelFlags} => ${newGuild.systemChannelFlags}`);
//         }

//         if(oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
//             description.push(`Rules Channel: ${oldGuild.rulesChannel} => ${newGuild.rulesChannel}`);
//         }

//         if(oldGuild.large !== newGuild.large) {
//             description.push(`Large: ${oldGuild.large} => ${newGuild.large}`);
//         }

//         if(oldGuild.unavailable !== newGuild.unavailable) {
//             description.push(`Unavailable: ${oldGuild.unavailable} => ${newGuild.unavailable}`);
//         }


//         description.push(`Server ID: ${newGuild.id}`);
//         if(executor) description.push(`Updated by: ${executor}`);

//         const embed = new EmbedBuilder()
//             .setTitle('Server Updated')
//             .setDescription(description.join('\n'))
//             .setTimestamp();

//         return targetChannel.send({ embeds: [embed] });

//     }

// };