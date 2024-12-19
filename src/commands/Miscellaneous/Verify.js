const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const {  } = process.env;
const { UserVerification } = require('../../models/UserSetups');
const { GetRobloxBio } = require('../../utils/Robox/Roblox');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify roblox and osu accounts')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        
        .addStringOption((option) => option
            .setName('platform')
            .setDescription('Platform to verify')
            .addChoices(
                { name: 'Roblox', value: 'roblox' },
                { name: 'osu!', value: 'osu' }
            )
            .setRequired(true)
        )
        .addNumberOption((option) => option
            .setName('id')
            .setDescription('Roblox user id or osu! user id')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        
        const { options, user } = interaction;
        await interaction.deferReply();
        
        const platform = options.getString('platform');
        const id = options.getNumber('id');

        console.log('aaaaaa');
        
        if (platform === 'roblox') {


            const oldBio = await GetRobloxBio(interaction.client, id);

            if (!oldBio) {
                const Embed = new EmbedBuilder()
                    .setTitle('Roblox Verification')
                    .setDescription('Roblox account not found. Failed to verify.')
                    .setColor(Colors.Red);
                return interaction.editReply({ embeds: [Embed] });
            }

            console.log('bbbbbb');

            // Verify roblox account
            const userVerification = await UserVerification.findOne({ discordUserId: user.id });

            if (userVerification) {
                if (userVerification.robloxUserIds.includes(id.toString())) {
                    const Embed = new EmbedBuilder()
                        .setTitle('Roblox Verification')
                        .setDescription('Roblox account already verified.')
                        .setColor(Colors.Red);
                    return interaction.editReply({ embeds: [Embed] });
                } 
            } else {
                const newUserVerification = new UserVerification({ discordUserId: user.id });
                await newUserVerification.save();
            }

            // random number 100000 - 999999
            const code = Math.floor(Math.random() * 900000) + 100000;

            const Button = new ButtonBuilder()
                .setCustomId('verify-roblox')
                .setLabel('Confirm Roblox Bio Change')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
                .setDisabled(false);
            
            const ActionRow = new ActionRowBuilder().addComponents(Button);

            const Embed = new EmbedBuilder()
                .setTitle('Roblox Verification')
                .setDescription(`Please change your roblox bio to include the following code: \`${code}\`\n\nOnce you have changed your bio, click the button below to verify.`)
                .setColor(Colors.Green)
                .setFooter('You have 10 minutes to complete this verification.');

            await interaction.editReply({ embeds: [Embed], components: [ActionRow] });


            const filter = (buttonInteraction) => {
                return buttonInteraction.user.id === user.id;
            };

            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600_000 });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === 'verify-roblox') {
                    const newBio = await GetRobloxBio(interaction.client, id);

                    if (newBio === oldBio) {
                        const Embed = new EmbedBuilder()
                            .setTitle('Roblox Verification')
                            .setDescription('Failed to verify roblox account. Please change your bio to include the code.')
                            .setColor(Colors.Red);
                        return interaction.editReply({ embeds: [Embed], components: [] });
                    } else {
                        if (!newBio.includes(code)) {
                            const Embed = new EmbedBuilder()
                                .setTitle('Roblox Verification')
                                .setDescription('Failed to verify roblox account. You changed your bio but did not include the code. Please try running the command again.')
                                .setColor(Colors.Red);
                            return interaction.editReply({ embeds: [Embed], components: [] });
                        } else {
                            // Verified roblox account
                            userVerification.robloxUserIds.push(id.toString());
                            await userVerification.save();

                            const Embed = new EmbedBuilder()
                                .setTitle('Roblox Verification')
                                .setDescription('Roblox account verified.')
                                .setColor(Colors.Green);
                            return interaction.editReply({ embeds: [Embed], components: [] });
                        }
                    }
                }
            });

            collector.on('end', async () => {
                const Embed = new EmbedBuilder()
                    .setTitle('Roblox Verification')
                    .setDescription('Verification timed out. Please try running the command again.')
                    .setColor(Colors.Red);
                return interaction.editReply({ embeds: [Embed], components: [] });
            });



            

        } else if (platform === 'osu') {
            // Verify osu account

            const Embed = new EmbedBuilder()
                .setTitle('Osu! Verification')
                .setDescription('Osu! verification is not yet implemented.')
                .setColor(Colors.Red);

            return interaction.editReply({ embeds: [Embed] });
        }
        
    }
};