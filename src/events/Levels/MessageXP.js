const { Events, ChannelType } = require('discord.js');
const { CooldownManager } = require('../../utils/Classes/cooldowns.js');
const { addUserMessageXP } = require('../../utils/Functions/Levels/XP-Database.js');
const { validateXPPreconditions } = require('../../utils/Functions/Levels/XP-Validation.js');

const cooldowns = new CooldownManager();

module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'Message XP | Levels',

    /**
     * @param {import('../../types.js').MessageUtils} message
     */
    async execute(message) {
        const { client, guild, channel, content, author, member } = message;

        if (author.bot || !guild || !member || channel.type !== ChannelType.GuildText || content.length <= 4) return;
        
        // Use the refactored validation function
        const validationResult = await validateXPPreconditions(member, channel);
        if (!validationResult) return;
        
        const { levelConfig, levelUpChannel } = validationResult;
        
        if (cooldowns.has('Message', member.id)) {
            return client.utils.LogData('Message Cooldown', `Guild: ${guild.name} | User: @${member.user.username}`, 'debug');
        }

        // Grant the user XP
        await addUserMessageXP(member, levelUpChannel, levelConfig);

        // Apply cooldown
        cooldowns.add('Message', member.id, levelConfig.messageCooldown);
    }
};