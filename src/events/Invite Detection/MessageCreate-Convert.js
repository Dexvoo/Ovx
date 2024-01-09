const { Events, Message } = require('discord.js');
const { CloudConvertAPIKey } = process.env;
const { permissionCheck } = require('../../utils/Checks.js');
const http = require('https'); // or 'https' for https:// URLs
const fs = require('fs');
const CloudConvert = require('cloudconvert');
const cloudConvert = new CloudConvert(CloudConvertAPIKey);

module.exports = {
	name: Events.MessageCreate,
	once: false,
	nickname: 'Convert WMV to MP4',

	/**
	 * @param {Message} message
	 */

	async execute(message) {
		const { client, guild, member, channel, content, author } = message;
		// Checking if the command is being used in a guild and if the author is a bot
		if (!guild || author.bot) return;

		if (guild.id !== '980647156962713610') return;

		// bot permissions
		const botPermissionsArry = [
			'SendMessages',
			'AttachFiles',
			'ManageMessages',
		];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) return;

		// Attachments
		const attachments = message.attachments;
		if (!attachments.size) return;

		// First Attachment
		const file = attachments.first();
		if (!file) return;

		// File Type
		const contentType = file.contentType;
		if (contentType !== 'video/x-ms-wmv') return;

		// get file name
		const fileName = file.name;

		// delete message
		await message.delete();

		// add file to channel
		const msg = await channel.send({
			content: `${member}, im converting your file`,
		});

		// download file
		let job = await cloudConvert.jobs.create({
			tasks: {
				'import-1': {
					operation: 'import/url',
					url: file.url.split('?', 1)[0],
					filename: fileName,
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

		const writeStream = fs.createWriteStream('./out/' + convertedFile.filename);

		http.get(convertedFile.url, function (response) {
			response.pipe(writeStream);
		});

		await new Promise((resolve, reject) => {
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
		});

		if (!msg) return console.log('No message found');

		/// edit message with converted file
		await msg.edit({
			content: `${member}, here is your converted file`,
			files: ['./out/' + convertedFile.filename],
		});
	},
};
