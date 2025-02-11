const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, GuildMember, Client, User, MessageFlags } = require('discord.js');
const { SendEmbed, consoleLogData } = require('../../utils/LoggingData')
require('dotenv').config();
const { DeveloperIDs } = process.env;

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Ban, unban, kick, timeout, remove timeout, purge messages, or change the nickname of a user')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        
        .addSubcommand(subcommand => subcommand
            .setName('ban')
            .setDescription('Ban a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to ban')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the ban')
                .setRequired(false)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('unban')
            .setDescription('Unban a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to unban')
                .setRequired(true)
            )
        )

        .addSubcommand(subcommand => subcommand
            .setName('kick')
            .setDescription('Kick a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to kick')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the kick')
                .setRequired(false)
            )
        )
        
        ,
    /**
    * @param {CommandInteraction} interaction
    */

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral]});

        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'ban':
                await BanUser(interaction);
                break;
            case 'unban':
                await UnbanUser(interaction);
                break;
            case 'kick':
                await KickUser(interaction);
                break;
            default: 
                consoleLogData('Moderation Command', `Unknown subcommand`, `error`)
                SendEmbed(interaction, Colors.Red, 'Failed Command', 'Unkown subcommand')
            break;
        };

    }
};

/**
* @param {CommandInteraction} interaction
*/
async function BanUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const targetMember = options.getMember('user');
    const reason = options.getString('reason') || 'No reason provided';
    const botMember = guild.members.me;

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `User Missing Permissions | \`BanMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `Bot Missing Permissions | \`BanMembers\``, []);

    
    // Checks
    if(targetUser.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Ban', 'I can\'t ban myself', []);
    if(targetUser.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Ban', 'You can\'t ban yourself', []);
    if(targetMember) {
        if (!targetMember.bannable) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `Bot Missing Permissions | \`RoleHierarchy\``, []);
        if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `You can\'t ban a member with a higher role than you`, []);
    };

    // Get Ban
    const isBanned = await guild.bans.fetch(targetUser.id).catch(() => null);
    if (isBanned) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `User already banned`, []);

    // If user is in the discord, DM them
    if(targetMember){
        const DMEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`You have been banned from **${guild.name}**`)
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
            );

        try {
            await targetMember.send({embeds: [DMEmbed]});
        } catch (error) {
            const FailedDMEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('DM Failed')
                .setDescription(`Could not DM user`)
            interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
        };
    };


    // Ban user
    try {
        await guild.bans.create(targetUser.id, { reason: `Banned by @${member.user.username} for: ${reason}`});
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Ban', `Bot Missing Permissions | \`Unknown\``, []);
    };

    SendEmbed(interaction, Colors.Blurple, 'Ban Successful', `You banned ${targetUser} from the server`, [
        { name: 'Reason', value: reason },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);

};




/**
* @param {CommandInteraction} interaction
*/
async function UnbanUser(interaction) {
    const { options, guild, client, member } = interaction;

    return

    const targetUser = options.getUser('user');
    const botMember = guild.members.me;

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Unban', `User Missing Permissions | \`BanMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Unban', `Bot Missing Permissions | \`BanMembers\``, []);

    // Get Ban
    const isBanned = await guild.bans.fetch(targetUser.id).catch(() => null);
    if (!isBanned) return SendEmbed(interaction, Colors.Red, 'Failed Unban', `User is not banned`, []);

    // Unban user
    try {
        await guild.bans.remove(targetUser.id, `Unbanned by @${member.user.username}`);
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Unban', `Bot Missing Permissions | \`${error}\``, []);
    };

    // If user is in a common discord server with bot, DM them
    await client.users.fetch(targetUser.id)
    .then(user => { 
        const DMEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`You have been unbanned from **${guild.name}**`)
            .addFields(
                { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
            );

        return user.send({ embeds: [DMEmbed]});
    })
    .catch(error => {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    })

    SendEmbed(interaction, Colors.Blurple, 'Unban Successful', `You Unbanned ${targetUser} from the server`, [
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);

};


/**
* @param {CommandInteraction} interaction
*/
async function KickUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const targetMember = options.getMember('user');
    const reason = options.getString('reason') || 'No reason provided';
    const botMember = guild.members.me;

    if(!targetMember) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `User is not in the server`, []);

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `User Missing Permissions | \`BanMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `Bot Missing Permissions | \`BanMembers\``, []);

    
    // Checks
    if(targetUser.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Kick', 'I can\'t kick myself', []);
    if(targetUser.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Kick', 'You can\'t kick yourself', []);
    if(!targetMember.kickable) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `Bot Missing Permissions | \`RoleHierarchy\``, []);
    if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `You can\'t kick a member with a higher role than you`, []);

    
    // If user is in the discord, DM them
    const DMEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`You have been kicked from **${guild.name}**`)
        .addFields(
            { name: 'Reason', value: reason },
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
        );
        
    try {
        await targetMember.send({embeds: [DMEmbed]});
    } catch (error) {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    };
    
    // Kick user
    try {
        await targetMember.kick({ reason: `Banned by @${member.user.username} for: ${reason}` })
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Kick', `Could not kick user : ${error}`);
    }

    SendEmbed(interaction, Colors.Blurple, 'Kick Successful', `You Kicked ${targetUser} from the server`, [
        { name: 'Reason', value: reason },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);

};