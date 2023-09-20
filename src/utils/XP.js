function getRandomXP(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1) + min);
}

// single line function
const calculateLevel = (level) => 100 * level || 1;

module.exports = { getRandomXP, calculateLevel };
