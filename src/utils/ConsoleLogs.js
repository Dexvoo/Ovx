const cleanConsoleLog = (log) => {
	// making sure the string is not longer than 84 characters
	console.log(`|${log.padStart(41 + log.length / 2, '-').padEnd(84, '-')}|`);
};

const cleanConsoleLogData = (title, description, type) => {
	if (!description) type = 'error' && (description = 'No description provided');
	switch (type) {
		case 'error':
			type = '\u001b[1;31m';
			title = `\u001b[1;31m[E] | ${title}`; // red
			break;
		case 'success':
			type = '\u001b[1;32m';
			title = `\u001b[1;32m[S] | ${title}`; // green
			break;
		case 'warning':
			type = '\u001b[1;33m';
			title = `\u001b[1;33m[W] | ${title}`; // yellow
			break;
		case 'info':
			type = '\u001b[1;34m';
			title = `\u001b[1;34m[I] | ${title}`; // blue
			break;
		case 'debug':
			type = '\u001b[1;35m';
			title = `\u001b[1;35m[D] | ${title}`; // purple
			break;
		default:
			type = '\u001b[1;37m';
			title = `\u001b[1;37m[?] | ${title}`; // white
			break;
	}

	const string = `${title} \u001b[0m| ${type}${description} \u001b[0m`.padEnd(
		105,
		' '
	);
	console.log(`| ${string}|`);
};

const sleep = (milliseconds) => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

module.exports = { cleanConsoleLog, cleanConsoleLogData, sleep };
