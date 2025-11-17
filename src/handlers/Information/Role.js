const { Colors } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function RoleInfo(interaction) {
    const { client } = interaction;
    const role = interaction.options.getRole('target');
    
    const fields = [
        { name: 'ID', value: `\`${role.id}\``, inline: true },
        { name: 'Color', value: `\`${role.hexColor}\``, inline: true },
        { name: 'Created', value: client.utils.Timestamp(role.createdAt, 'F'), inline: true },
        { name: 'Position', value: `\`${role.position}\``, inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Members', value: `\`${role.members.size}\``, inline: true },
    ];

    await client.utils.Embed(interaction, role.color, `ℹ️ Role Information: ${role.name}`, '', { fields });
};