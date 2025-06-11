// const { Events, EmbedBuilder, Colors, ApplicationCommandOptionType, ChatInputCommandInteraction, AuditLogEvent, GuildAuditLogsEntry, Guild } = require('discord.js');
// const { consoleLogData, SendEmbedLog } = require('../../utils/LoggingData.js');
// require('dotenv').config()
// const { CommandCID, JoinGuildCID, LeaveGuildCID, UserLevelCID, DevGuildID } = process.env

// module.exports = {
//     name: Events.GuildAuditLogEntryCreate,
//     once: false,
//     nickname: 'Command Logs',


//     /**
//      * 
//      * @param {GuildAuditLogsEntry} auditLog 
//      * @param {Guild} guild
//      * @returns 
//      */

//     async execute(auditLog, guild) {
//         const { action, extra: channel, executorId, targetId } = auditLog;
//         const { client } = guild;

//         if(action !== AuditLogEvent.MessageDelete) return;

//         try {
//             const executor = client.users.cache.get(executorId) || await client.users.fetch(executorId);
//             const target = client.users.cache.get(targetId) || await client.users.fetch(targetId);
            
//             console.log(`A message by ${target.tag} was deleted by ${executor.tag} in #${channel.name}`);

//         } catch (error) {
//             console.error(error);
//             consoleLogData('Command Logs', 'Failed to send command log', 'error');
//         }
//     }
// };



// //          const fetchedLogs = await guild.fetchAuditLogs(
// //             { limit: 1, type: AuditLogEvent.MessageDelete }
// //         ).catch(() => { return false });

// //         if (!fetchedLogs) return consoleLogData('error', 'Failed to fetch audit logs for message delete event.');

// //         // console.log(fetchedLogs)

// //         const deletionLog = fetchedLogs.entries.first();
// //         const logTime = Date.now()
// //         if (!deletionLog) {
// //             consoleLogData('SELF DELETED', `No deletion log found, probably self deleted`, 'info');
// //             return;
// //         }

// //         const { executor, target, createdTimestamp } = deletionLog;

// //         if(target.id === author.id && createdTimestamp > logTime - 5000) {
// //             // deleted by someone else
// //             consoleLogData('USER DELETED', `A message by ${author.tag} was deleted by ${executor.tag} in #${channel.name}`, 'info');
// //         } else {
// //             // self deleted
// //             consoleLogData('SELF DELETED', `A message by ${author.tag} was deleted in #${channel.name}`, 'info');
// //         }






// // GuildAuditLogs {
// //     webhooks: Collection(0) [Map] {},
// //     integrations: Collection(0) [Map] {},
// //     guildScheduledEvents: Collection(0) [Map] {},
// //     applicationCommands: Collection(0) [Map] {},
// //     autoModerationRules: Collection(0) [Map] {},
// //     entries: Collection(1) [Map] {
// //         '1379877997108138005' => GuildAuditLogsEntry {
// //         targetType: 'Message',
// //         actionType: 'Delete',
// //         action: 72,
// //         reason: null,
// //         executorId: '987324257405132820',
// //         executor: [User],
// //         changes: [],
// //         id: '1379877997108138005',
// //         extra: [Object],
// //         targetId: '387341502134878218',
// //         target: [User]
// //         }
// //     }
// // }