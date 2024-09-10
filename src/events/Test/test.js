const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildBanAdd,
    once: false,
    nickname: 'Test',

    /**
     * @param {Guild} guild
     * @param {User} user
     */

    async execute(guild, user) {
        console.log(`${user.tag} was banned from ${guild.name}`);
    }
}