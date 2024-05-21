function getRandomReadableWords() {
	const words = [
		'Dexvo',
		'Voix',
		'Xen',
		'Wicked',
		'Ru',
		'Omtric',
		'Keith',
		'Tune',
		'Blaze',
		'Ares',
		'Echo',
		'Pablo',
		'Sage',
		'Uni',
		'Starr',
		'Oliver',
		'Olivia',
		'Jack',
		'Amelia',
		'Harry',
		'Isla',
		'George',
		'Ava',
		'Noah',
		'Sophia',
		'William',
		'Grace',
		'James',
		'Lily',
		'Henry',
		'Samuel',
		'Ella',
		'Charlie',
		'Isabella',
		'Thomas',
		'Poppy',
		'Alexander',
		'Freya',
		'Arthur',
		'Emily',
		'Alfie',
		'Oscar',
		'Evie',
		'Leo',
		'Rosie',
		'Ethan',
		'Ivy',
		'Jacob',
		'Harper',
		'Freddie',
		'Daisy',
		'Benjamin',
		'Chloe',
		'Daniel',
		'Isabelle',
		'Max',
		'Sofia',
		'Joshua',
		'Phoebe',
		'Archie',
		'Alice',
		'Samuel',
		'Charlotte',
		'Joseph',
		'Matilda',
		'Logan',
		'Ruby',
		'Caleb',
		'Elsie',
		'Dylan',
		'Amelia',
		'Isaac',
		'Esme',
		'Lucas',
		'Erin',
		'Edward',
		'Lucy',
		'Finley',
		'Florence',
		'Aiden',
		'Ellie',
		'Harrison',
		'Maisie',
		'Daniel',
		'Aria',
		'Ethan',
		'Thea',
		'Caleb',
		'Luna',
		'Jackson',
		'Imogen',
		'Sebastian',
		'Harper',
		'Liam',
		'Zara',
		'Matthew',
		'Layla',
		'Toby',
		'Penelope',
		'Theo',
		'Lola',
		'Mason',
		'Grace',
		'Ryan',
		'Aurora',
		'David',
		'Hannah',
		'Michael',
		'Abigail',
		'Luke',
		'Jessica',
		'Gabriel',
		'Eleanor',
	]
		.sort(() => Math.random() - Math.random())
		.slice(0, 2);

		var randomWords;
		// every 2 letters, add a random number
		for (let i = 0; i < words.length; i++) {
			// ADD 1 RANDOM NUMBER  TO THE WORD
			// get string length
			const wordLength = words[i].length;

			// get random number
			const randomNumber = Math.floor(Math.random() * 10);

			// get random position
			const randomPosition = Math.floor(Math.random() * wordLength);

			// add random number to the word
			randomWords = words[i].slice(0, randomPosition) + randomNumber + words[i].slice(randomPosition);

			// replace the word
			words[i] = randomWords;

			
			
		}
		return words.join(' ');
}

module.exports = { getRandomReadableWords };
