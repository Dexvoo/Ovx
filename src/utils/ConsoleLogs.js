const cleanConsoleLog = (log) => {
	// making sure the string is not longer than 84 characters
	console.log(`|${log.padStart(41 + log.length / 2, '-').padEnd(84, '-')}|`);
};

const cleanConsoleLogData = (title, description) => {
	// if there is no description, then it is an error
	if (!description) {
		const string = `${title}\u001b[0m`.padEnd(77, ' ');
		console.log(`| \u001b[1;31m[Error] | ${string}|`);
		return;
	}
	const string = `${title} \u001b[0m| ${description}`.padEnd(86, ' ');
	console.log(`| \u001b[1;32m/${string}|`);
};

const sleep = (milliseconds) => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

module.exports = { cleanConsoleLog, cleanConsoleLogData, sleep };
