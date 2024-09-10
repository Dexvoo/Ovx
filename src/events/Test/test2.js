const { Events, GuildBan, AuditLogEvent, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.GuildBanRemove,
    once: false,
    nickname: 'Test',

    /**
     * @param {GuildBan} ban
     */

    async execute(ban) {
        const { guild, user } = ban;

        console.log(ban);
        console.log(`${ban.user.tag} was unbanned from ${ban.guild.name}`);

        // find out who unbanned then

        const fetchedLogs = await guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.GuildBanRemove }
        ).catch(() => { return false });

        const deletionLog = fetchedLogs?.entries?.first();
        let executor = deletionLog ? deletionLog.executor : null;
        

        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';
        
        console.log(`${executor}`);


    }
}