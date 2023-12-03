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
	CloudConvertAPIKey,
} = process.env;
require('dotenv').config();
const http = require('https'); // or 'https' for https:// URLs
const fs = require('fs');
const CloudConvert = require('cloudconvert');
const cloudConvert = new CloudConvert(CloudConvertAPIKey);

module.exports = {
	cooldown: 0,
	catagory: 'Developer',
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

			const file = options.getAttachment('file');
			const contentType = file.contentType;
			if (contentType !== 'video/x-ms-wmv') {
				return console.log('Invalid file type');
			}
			await interaction.reply({ content: `${file.url.split('?', 1)[0]}` });

			let job = await cloudConvert.jobs.create({
				tasks: {
					'import-1': {
						operation: 'import/url',
						url: file.url.split('?', 1)[0],
						filename: 'test.wmv',
					},
					'task-1': {
						operation: 'convert',
						input_format: 'wmv',
						output_format: 'mp4',
						engine: 'ffmpeg',
						input: ['import-1'],
						video_codec: 'x264',
						crf: 23,
						preset: 'medium',
						fit: 'scale',
						fps: 30,
						subtitles_mode: 'none',
						audio_codec: 'aac',
						audio_bitrate: 128,
					},
					'export-1': {
						operation: 'export/url',
						input: ['task-1'],
						inline: false,
						archive_multiple_files: false,
					},
				},
				tag: 'jobbuilder',
			});

			job = await cloudConvert.jobs.wait(job.id);

			const convertedFile = cloudConvert.jobs.getExportUrls(job)[0];

			const writeStream = fs.createWriteStream(
				'./out/' + convertedFile.filename
			);

			http.get(convertedFile.url, function (response) {
				response.pipe(writeStream);
			});

			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve);
				writeStream.on('error', reject);
			});

			const embed = new EmbedBuilder()
				.setTitle('File Converted')
				.setColor(EmbedColour)
				.setDescription(`File has been converted.`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			// add file to channel
			await channel.send({
				embeds: [embed],
				files: ['./out/' + convertedFile.filename],
			});
		} catch (error) {
			console.log(error);
		}
	},
};
