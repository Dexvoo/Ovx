function getRandomXP(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min);
}

// Single line function to calculate the XP required for a certain level
const calculateLevel = (level) => level > 0 ? 100 * level : 0;

const getLevelFromXP = (xp) => {
	// Calculate the level and leftover XP based on the total XP
	let level = 0;
	let xpLeftOver = xp;

	while (xpLeftOver >= calculateLevel(level + 1)) {
		level++;
		xpLeftOver -= calculateLevel(level);
	}
	return [level, xpLeftOver];
};

module.exports = { getRandomXP, calculateLevel, getLevelFromXP };