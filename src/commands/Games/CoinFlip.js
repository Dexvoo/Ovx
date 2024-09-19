const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');

const choices = [
    { name: 'Heads', beats: 'Tails', emoji: '<:OVX_Tails:1286316509525704766>' },
    { name: 'Tails', beats: 'Heads', emoji: '<:OVX_Heads:1286316499446796400>' },
]

module.exports = {
    cooldown: 5,
    category: 'Games',
    userpermissions: [],
    botpermissions: [PermissionFlagsBits.UseExternalEmojis],
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin')
        .setContexts( InteractionContextType.Guild )
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('The amount of cash you want to bet')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('side')
            .setDescription('The side you want to bet on')
            .setRequired(true)
            .addChoices(
                { name: 'Heads', value: 'Heads' },
                { name: 'Tails', value: 'Tails' }
            )
        )
        .addUserOption(option => option
            .setName('user')
            .setDescription('The user you want to bet against')
            .setRequired(false)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;

        
        const amount = options.getInteger('amount');
        const side = options.getString('side');
        const targetUser = options.getUser('user');

        // no max bet
        var userCurrency = await UserCurrency.findOne({ userId: user.id });

        if(!userCurrency) {
            userCurrency = new UserCurrency({
                userId: user.id,
            });
            await userCurrency.save();
        }

        if(amount < 1) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`The amount must be greater than 0`);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        if(userCurrency.cash < amount) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`You don't have enough cash`);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        if(!targetUser) {
            // bet against the bot
            const randomNumber = Math.floor(Math.random() * (2 - 0) + 0);
            const sides = ['heads', 'tails'];

            if(sides[randomNumber] === side) {

                userCurrency.cash += amount;
                await userCurrency.save();

                const Embed = new EmbedBuilder()
                    .setColor('Blurple')
                    .setDescription(`You won ${amount} cash!`);
                return await interaction.reply({ embeds: [Embed] });
            } else {

                userCurrency.cash -= amount;
                await userCurrency.save();

                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`You lost ${amount} cash!`);
                return await interaction.reply({ embeds: [Embed] });
            }
        }


        // bet against another user
        if(targetUser.id === user.id) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`You can't bet against yourself`);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        var targetCurrency = await UserCurrency.findOne({ userId: targetUser.id });

        if(!targetCurrency) {
            targetCurrency = new UserCurrency({
                userId: targetUser.id,
            });
            await targetCurrency.save();
        }

        if(amount > targetCurrency.cash) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`The target user doesn't have enough cash`);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        const StartGameEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`${user.username} has challenged ${targetUser.username} to a coinflip for ${amount.toLocaleString()} cash!`);

        
        const Buttons = choices.map(choice => {
            return new ButtonBuilder()
                .setCustomId(`Ovx_Coinflip_${choice.name}`)
                .setLabel(`${choice.name}`)
                .setEmoji(choice.emoji)
                .setStyle(ButtonStyle.Primary)
        });

        const row = new ActionRowBuilder().addComponents(Buttons);

        const reply = await interaction.reply({ content: `${targetUser}`, embeds: [StartGameEmbed], components: [row] });

        const targetUserInteraction = await reply.awaitMessageComponent({ filter: i => i.user.id === targetUser.id, time: 60_000 }).catch(async () => {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`Game over, ${targetUser} did not respond in time`);
                await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
            return
        }).catch(async () => {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`Game over, ${targetUser} did not respond in time`);
                await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
            return
        });

        if(!targetUserInteraction) return;

        const targetUserChoice = choices.find(choice => targetUserInteraction.customId === `Ovx_Coinflip_${choice.name}`);
        const userChoice = choices.find(choice => targetUserChoice.beats === choice.name);
        
        const randomNumber = Math.floor(Math.random() * (2 - 0) + 0);
        const sides = ['Heads', 'Tails'];

        if(sides[randomNumber] === userChoice.name) {
                
                userCurrency.cash += amount;
                targetCurrency.cash -= amount;
                await userCurrency.save();
                await targetCurrency.save();
    
                const Embed = new EmbedBuilder()
                    .setColor('Blurple')
                    .setDescription(`User: @${user.username} : ${userChoice.name} ${userChoice.emoji}\nTarget: @${targetUser.username} : ${targetUserChoice.name} ${targetUserChoice.emoji} \n\n${user.username} won ${amount} cash!`);
                await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
            } else {
    
                userCurrency.cash -= amount;
                targetCurrency.cash += amount;
                await userCurrency.save();
                await targetCurrency.save();
    
                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`User: @${user.username} : ${userChoice.name} ${userChoice.emoji}\nTarget: @${targetUser.username} : ${targetUserChoice.name} ${targetUserChoice.emoji} \n\n${targetUser.username} won ${amount} cash!`);
                await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
            }
        

        // await reply.edit({ embeds: [StartGameEmbed], components: [] }).catch(() => {});




    }

};