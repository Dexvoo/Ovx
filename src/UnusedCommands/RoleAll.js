const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, parseEmoji, InteractionContextType } = require('discord.js');
const { DeveloperIDs } = process.env;

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('roleall')
        .setDescription('give all members in the guild a role')
        .setContexts( InteractionContextType.Guild )
        
        .addStringOption(option => option
            .setName('type')
            .setDescription('Add or remove the role from all members')
            .setRequired(true)
            .addChoices(
                { name: 'Add', value: 'add' },
                { name: 'Remove', value: 'remove' }
            )
        )
        .addRoleOption(option => option
            .setName('role')
            .setDescription('The role to give to all members')
            .setRequired(true)
        ),
    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
        await interaction.deferReply({ ephemeral: true });
        
        if (!DeveloperIDs.includes(member.id)) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('You must be a developer to use this command');
            return await interaction.editReply({ embeds: [Embed] });
        }

        const role = options.getRole('role');
        const type = options.getString('type');

        if (!role) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('Please provide a valid role');
            return await interaction.editReply({ embeds: [Embed] });
        }

        const estimatedTime = guild.memberCount * 1000
        const currentTime = new Date().getTime();
        const endTime = currentTime + estimatedTime;

        const embed = new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setDescription(`This may take a while, estimated time: ${getDiscordTimestamp(endTime)}`);
        await interaction.editReply({ embeds: [embed] });

        

        const members = await guild.members.fetch();
        const successful = [];
        const failed = [];
        if (type === 'add') {
            for (const member of members.values()) {
                try {
                    await member.roles.add(role);
                    console.log(`Added role to ${member.user.tag}`);
                    successful.push(member.id);
                } catch (error) {
                    console.log(`Failed to add role to ${member.user.tag}`);
                    failed.push(member.id);
                }
            }
        } else if (type === 'remove') {
            for (const member of members.values()) {
                try {
                    await member.roles.remove(role);
                    console.log(`Removed role from ${member.user.tag}`);
                    successful.push(member.id);
                } catch (error) {
                    console.log(`Failed to remove role from ${member.user.tag}`);
                    failed.push(member.id);
                }
            }
        }


        const FollowUp = new EmbedBuilder()
            .setColor(Colors.Green)
            .setDescription(`Successfully ${type} role to ${successful.length} members\nFailed to add/remove role to ${failed.length} members`);

        await interaction.member.send({ embeds: [FollowUp] });

        
    }

};


function getDiscordTimestamp (date) {
    return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}