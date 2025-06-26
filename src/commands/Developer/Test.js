const { SlashCommandBuilder, Colors, InteractionContextType, CommandInteraction, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, Interaction, Events, GuildMember, TextChannel, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ThumbnailBuilder, SectionBuilder, ComponentType } = require('discord.js');

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('(Developer) Reloads a command')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    /**
    * @param {import('../../types').CommandInputUtils} interaction
    */

    async execute(interaction) {
        const { options, client, user } = interaction;

        if(!client.utils.DevCheck(user.id)) return client.utils.Embed(interaction, Colors.Red, 'Command Failed', `User Missing Permission: \`Developer\``);
        
        SendEmbedv2(
            interaction, 
            `Member Updated: Changed Avatar`, 
            `Old: [Here](${user.displayAvatarURL({extension: 'png'})}) => New: [Here](${user.avatarURL({extension: 'png'})})`, 
            `UID: ${interaction.member.id}`, 
            user.avatarURL({extension: 'png'}),
        );
    }
};


/**
* @param {Interaction | TextChannel | GuildMember } messageTarget 
* @param {String} title 
* @param {String} description
* @param {String} footer
*/
const SendEmbedv2 = async (messageTarget, title, description, footer, thumbnail) => {
    if (!messageTarget) throw new Error('No interaction provided.');
    if (!title) throw new Error('No title provided.');
    if (!description) throw new Error('No description provided.');

    const containerComponent = new ContainerBuilder()

    const textComponentTitle = new TextDisplayBuilder()
        .setContent(`# ${title}`);

    const separatorComponent = new SeparatorBuilder()
        .setDivider(true)

    const textComponentDescription = new TextDisplayBuilder()
        .setContent(`${description.substring(0, 1000)}`);
    const textComponentFooter = new TextDisplayBuilder()
        .setContent(`-# ${footer.substring(0, 1000)}`);

    const thumbnailComponent = new ThumbnailBuilder({
        description: 'some text',
        media: {
            url: thumbnail,
        },
    });

    const sectionComponent = new SectionBuilder({
    })

    sectionComponent.setThumbnailAccessory(thumbnailComponent)
    sectionComponent.addTextDisplayComponents(textComponentDescription, textComponentFooter)


    containerComponent.addTextDisplayComponents(textComponentTitle);
    containerComponent.addSeparatorComponents(separatorComponent);
    containerComponent.addSectionComponents(sectionComponent)
    // containerComponent.addTextDisplayComponents(textComponentDescription, textComponentFooter);

    // const sectionComponent = new SectionBuilder()
    //     .setThumbnailAccessory(thumbnailComponent)

    // containerComponent.addSectionComponents(sectionComponent)
    if(messageTarget instanceof (CommandInteraction)) {
        console.log(messageTarget)

        // Check if the channel exists and is accessible
        if (!messageTarget.channel) {
            // try to fetch the channel if it doesn't exist
            try {
                await messageTarget.guild.channels.fetch(interaction.channelId);
            } catch (error) {
                return console.error('Channel not found or inaccessible:', error);
            }
        }

        try {
            if (messageTarget.replied || messageTarget.deferred) {
                return await messageTarget.editReply({ flags: [MessageFlags.IsComponentsV2], components: [containerComponent], allowedMentions: { parse: [] } });
            } else {
                return await messageTarget.reply({ flags: [MessageFlags.IsComponentsV2], components: [containerComponent], allowedMentions: { parse: [] } });
            }
        } catch (error) {
            console.error('Failed to send embed:', error);
        }
    } else if (messageTarget instanceof TextChannel) {
            messageTarget.send({ flags: [MessageFlags.IsComponentsV2, ephemeral ? MessageFlags.Ephemeral : null], components: [containerComponent], allowedMentions: { parse: [] } })
        
    }

    
}