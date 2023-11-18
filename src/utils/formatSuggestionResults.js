const pb = {
	le: '<:ProgressBar_LE:1175241679977066547>',
	me: '<:ProgressBar_ME:1175241677074616415>',
	re: '<:ProgressBar_RE:1175241674826453012>',
	lf: '<:ProgressBar_LF:1175241673459118101>',
	mf: '<:ProgressBar_MF:1175241672049831946>',
	rf: '<:ProgressBar_RF:1175241669034115132>',
};

function formatResults(upvotes = [], downvotes = []) {
	const totalVotes = upvotes.length + downvotes.length;
	const progressBarLength = 14;
	const filledSquares =
		Math.round((upvotes.length / totalVotes) * progressBarLength) || 0;
	const emptySquares = progressBarLength - filledSquares || 0;

	if (!filledSquares && !emptySquares) {
		emptySquares = progressBarLength;
	}

	const upPercentage = (upvotes.length / totalVotes) * 100 || 0;
	const downPercentage = (downvotes.length / totalVotes) * 100 || 0;

	const progressBar =
		(filledSquares ? pb.lf : pb.le) +
		(pb.mf.repeat(filledSquares) + pb.me.repeat(emptySquares)) +
		(filledSquares === progressBarLength ? pb.rf : pb.re);

	const results = [];
	results.push(
		`👍 ${upvotes.length} upvotes (${upPercentage.toFixed(1)}%) • 👎 ${
			downvotes.length
		} downvotes (${downPercentage.toFixed(1)}%)`
	);
	results.push(progressBar);

	return results.join('\n');
}

module.exports = formatResults;
