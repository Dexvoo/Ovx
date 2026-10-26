/**
 * @param {Number} timestamp
 * @returns {String} - Short timestamp
 */
const ShortTimestamp = (timestamp) => {
    if (!timestamp) throw new Error('No timestamp provided.');
    const date = new Date(timestamp);
    return `<t:${Math.round(date.getTime() / 1000)}:R>`;
};

/**
 * Generates a Discord-formatted timestamp.
 *
 * @param {Date | number} date - Date or number
 * @param {'f' | 'F' | 'd' | 'D' | 't' | 'T' | 'R'} [type='R'] - Discord timestamp format
 * @returns {string} Formatted Discord timestamp string
 */

function Timestamp(date, type = 'R') {
    if (!date) throw new Error('No date provided.');

    const timestamp = date instanceof Date ? Math.floor(date.getTime() / 1000) : Math.floor(date / 1000);
    return `<t:${timestamp}:${type}>`;
}

export { ShortTimestamp, Timestamp };
