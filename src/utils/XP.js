function getRandomXP(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min);
}

// single line function
const calculateLevel = (level) => 100 * level || 1;

const getLevelFromXP = (xp) => {
	// every level adds 100 xp to the next level, and a variable with the amount of xp that the user has
	let level = 0;
	let xpLeftOver = xp;
	while (xpLeftOver >= calculateLevel(level)) {
		xpLeftOver -= calculateLevel(level);
		level++;
	}
	return [level - 1, xpLeftOver];
};

module.exports = { getRandomXP, calculateLevel, getLevelFromXP };
