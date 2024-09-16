const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, parseEmoji, InteractionContextType } = require('discord.js');

module.exports = {
    cooldown: 5,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.ManageGuildExpressions],
    botpermissions: [PermissionFlagsBits.ManageGuildExpressions],
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Take/edit/delete an emoji from the server')
        .setContexts( InteractionContextType.Guild )
        .addSubcommand(subcommand => subcommand
            .setName('take')
            .setDescription('Take an emoji from a guild')
            .addStringOption(option => option
                .setName('emoji')
                .setDescription('The emoji to take')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('emoji2')
                .setDescription('The emoji to take')
                .setRequired(false)
            )
            .addStringOption((option) => option
                .setName('emoji3')
                .setDescription('The emoji you would like to take.')
                .setRequired(false)
            )
            .addStringOption((option) => option
                .setName('emoji4')
                .setDescription('The emoji you would like to take.')
                .setRequired(false)
            )
            .addStringOption((option) => option
                .setName('emoji5')
                .setDescription('The emoji you would like to take.')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('edit')
            .setDescription('Edit an emoji from a guild')
            .addStringOption((option) => option
                .setName('emoji')
                .setDescription('The emoji you would like to edit.')
                .setRequired(true)
            )
            .addStringOption((option) => option
                .setName('name')
                .setDescription('The name of the emoji.')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('delete')
            .setDescription('Delete an emoji from a guild')
            .addStringOption(option => option
                .setName('emoji')
                .setDescription('The emoji to delete')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('list')
            .setDescription('List all emojis from a guild')
        ),
    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
        const subcommand = options.getSubcommand();

        await interaction.deferReply();

        try {

            const emoji = options.getString('emoji') || '<a:OVX_Yes:1115593935746781185>'
            const emojiCheck = parseEmoji(emoji);

            if(!emojiCheck.id) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Please provide a valid emoji.')
                return await interaction.editReply({ embeds: [Embed] });
            }

            switch (subcommand) {
                case 'take':
                    await handleTakeCommand(interaction, emojiCheck);
                    break;

                case 'edit':
                    await handleEditCommand(interaction, emojiCheck);
                    break;

                case 'delete':
                    await handleDeleteCommand(interaction, emojiCheck);
                    break;
                case 'list':
                    await handleListEmojis(interaction);
            break;
        }

        } catch (error) {
            console.error(error);
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('There was an error while executing this command!')
            await interaction.editReply({ embeds: [Embed] });
            
        }
        
    }

};

/**
 * 
 * @param {CommandInteraction} interaction 
 */

async function handleListEmojis(interaction) {
    const { guild } = interaction;

    const staticEmojis = guild.emojis.cache.filter(emoji => !emoji.animated);
    const animatedEmojis = guild.emojis.cache.filter(emoji => emoji.animated);

    const emojiEmbeds = [];

    let emojiString = '';
    for(const emoji of staticEmojis) {

        const currentEmoji = `${emoji[1]}`
        if(emojiString.length + currentEmoji.length >= 2000) {

            if(emojiString.length > 0) {
                const emojiEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setTitle('Static Emojis')
                    .setDescription(emojiString)

                emojiEmbeds.push(emojiEmbed);
                emojiString = '';
            }
        }

        emojiString += `${currentEmoji} `;
    }

    if(emojiString.length > 0) {
        const emojiEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle('Static Emojis')
            .setDescription(emojiString)

        emojiEmbeds.push(emojiEmbed);
        emojiString = '';
    }

    for(const emoji of animatedEmojis) {
        const currentEmoji = `${emoji[1]}`
        if(emojiString.length + currentEmoji.length >= 1300) {
            if(emojiString.length > 0) {
                const emojiEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setTitle('Animated Emojis')
                    .setDescription(emojiString)

                emojiEmbeds.push(emojiEmbed);
                emojiString = '';
            }
        }

        emojiString += `${currentEmoji} `;
    };

    if(emojiString.length > 0) {
        const emojiEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle('Animated Emojis')
            .setDescription(emojiString)

        emojiEmbeds.push(emojiEmbed);
        emojiString = '';
    }

    if(emojiEmbeds.length < 1) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('No emojis found in this server.')
        return await interaction.editReply({ embeds: [Embed] });
    }

    await interaction.editReply({ embeds: emojiEmbeds });
}

function verifyEmojiName(emojiName) {
	if (emojiName.length > 32) return false;
	return true;
}

function verifyEmojiGuild(guild, emojiId) {
	const guildEmojis = guild.emojis.cache.map((emoji) => emoji.id);
	if (guildEmojis.includes(emojiId)) return true;
	return false;
}

async function handleTakeCommand(interaction) {
    const { options, client, member, guild, user, channel } = interaction;

    const emoji = options.getString('emoji');
    const emoji2 = options.getString('emoji2');
    const emoji3 = options.getString('emoji3');
    const emoji4 = options.getString('emoji4');
    const emoji5 = options.getString('emoji5');
    const guildBoostLevel = guild.premiumTier;
    const guildAnimatedEmojis = guild.emojis.cache.filter(emoji => emoji.animated).size;
    const guildStaticEmojis = guild.emojis.cache.filter(emoji => !emoji.animated).size;
    const allEmojis = [ emoji, emoji2, emoji3, emoji4, emoji5 ]
    const validEmojis = [];
    validEmojis.push(...allEmojis.filter(emoji => emoji !== null && emoji !== undefined && emoji !== ''));
    var maxGuildEmojis
    const successEmojis = [];

    switch (guildBoostLevel) {
        case 1:
            maxGuildEmojis = 100;
            break;
        case 2:
            maxGuildEmojis = 150;
            break;
        case 3:
            maxGuildEmojis = 250;
            break;
        default:
            maxGuildEmojis = 50; // Default value if none of the cases match
            break;
    }

    if(guildAnimatedEmojis > maxGuildEmojis - allEmojis.length) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('You have reached the maximum amount of animated emojis for this server.')
        return await interaction.editReply({ embeds: [Embed] });
    }

    if(guildStaticEmojis > maxGuildEmojis - allEmojis.length) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('You have reached the maximum amount of static emojis for this server.')
        return await interaction.editReply({ embeds: [Embed] });
    }

    for(const emoji of validEmojis) {
        const emojiCheck = parseEmoji(emoji);

        if(!emojiCheck.id) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('Please provide a valid emoji.')
            await interaction.followUp({ embeds: [Embed] });
            continue;
        }

        const emojiName = `OVX_${emojiCheck.name}`;
        const extension = emojiCheck.animated ? '.gif' : '.png';
        const emojiURL = `https://cdn.discordapp.com/emojis/${emojiCheck.id}${extension}`;
        
        if(!verifyEmojiName(emojiName)) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('Emoji name is too long.')
            await interaction.followUp({ embeds: [Embed] });
            continue;
        }

        try {
            
            await guild.emojis.create({ attachment: emojiURL, name: emojiName })
            .then((newEmoji => successEmojis.push(newEmoji)))
            .catch((error) => console.error(error));
        } catch (error) {
            console.error(error);
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`Failed to take emoji: ${emoji}`)

            return await interaction.followUp({ embeds: [Embed] });
        }

    }

    const emojiTakenEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Successfully taken emoji(s): ${successEmojis.map(emoji => emoji.toString()).join(' • ')}`)
    await interaction.editReply({ embeds: [emojiTakenEmbed] });
}

async function handleEditCommand(interaction, emojiCheck) {
    const { options, client, member, guild, user, channel } = interaction;

    const guildCheckEdit = verifyEmojiGuild(guild, emojiCheck.id);

    if(!guildCheckEdit) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('This emoji is not part of this server.')
        return await interaction.editReply({ embeds: [Embed] });
    }

    const emojiName = options.getString('name');

    if(!verifyEmojiName(emojiName)) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Emoji name is too long.')
        return await interaction.editReply({ embeds: [Embed] });
    }

    try {
        const newEmoji = await guild.emojis.edit(emojiCheck.id, { name: emojiName });
        const emojiEditEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`Successfully edited emoji: ${newEmoji.toString()}`)
        await interaction.editReply({ embeds: [emojiEditEmbed] });
    } catch (error) {
        console.error(error);
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(`Failed to edit emoji: ${emoji}`)
        await interaction.editReply({ embeds: [Embed] });
    }
}

async function handleDeleteCommand(interaction, emojiCheck) {
    const { options, client, member, guild, user, channel } = interaction;

    const guildCheckDelete = verifyEmojiGuild(guild, emojiCheck.id);

    if(!guildCheckDelete) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('This emoji is not part of this server.')
        return await interaction.editReply({ embeds: [Embed] });
    }

    try {
        await guild.emojis.delete(emojiCheck.id);
        const emojiDeleteEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`Successfully deleted emoji: ${emojiCheck.name}`)
        await interaction.editReply({ embeds: [emojiDeleteEmbed] });
    } catch (error) {
        console.error(error);
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(`Failed to delete emoji: ${emoji}`)
        await interaction.editReply({ embeds: [Embed] });
    }
}