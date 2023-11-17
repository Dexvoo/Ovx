const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const UserCurrency = require('../../models/UserCurrency.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
require('dotenv').config();
const http = require('https'); // or 'https' for https:// URLs
const fs = require('fs');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('developer test command.')
		.setDMPermission(false)
		.addAttachmentOption((option) =>
			option
				.setName('file')
				.setDescription('The file to convert.')
				.setRequired(true)
		),

	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			const { guild, member, options, user, client, channel } = interaction;
			if (user.id !== '387341502134878218') {
				await sendEmbed(
					interaction,
					'You do not have permission to use this command.'
				);
			}

			// const file = options.getAttachment('file');
			// const contentType = file.contentType;
			// if (contentType !== 'video/x-ms-wmv') {
			// 	return console.log('Invalid file type');
			// }
			// await interaction.reply({ content: `${file.url}` });

			// const targetfile = fs.createWriteStream(
			// 	'C:/Users/Jack/Desktop/Ovx/videos/test.wmv'
			// );
			// const request = http.get(file.url, function (response) {
			// 	response.pipe(targetfile);

			// 	// after download completed close filestream
			// 	targetfile.on('finish', () => {
			// 		targetfile.close();

			// 		// where does my file save to
			// 		console.log(targetfile.path);

			// 		console.log('Download Completed');

			// 		const embed = new EmbedBuilder()
			// 			.setColor(EmbedColour)
			// 			.setTitle('Test')
			// 			.setTimestamp()
			// 			.setFooter({ text: FooterText, iconURL: FooterImage })
			// 			.setImage('targetfile.path');

			// 		interaction.editReply({ embeds: [embed], attachments: [] });
			// 	});
			// });

			// hbjs
			// 	.spawn({ input: file.url, output: `${targetfile.path}.mp4` })
			// 	.on('error', (err) => {
			// 		// invalid user input, no video found etc
			// 		console.log('errorrrrr');
			// 	})
			// 	.on('progress', (progress) => {
			// 		console.log(
			// 			'Percent complete: %s, ETA: %s',
			// 			progress.percentComplete,
			// 			progress.eta
			// 		);
			// 	})
			// 	.on('complete', () => {
			// 		console.log('complete');
			// 	});

			// add converted file to embe
		} catch (error) {
			console.log(error);
		}
	},
};
