/**
 * Truncates a string to a specified length and appends an ellipsis.
 * @param {string} str - The string to truncate.
 * @param {number} [maxLength=1024] - Maximum allowed length (1024 is the Discord embed field limit).
 * @returns {string} The truncated string.
 */
export function Truncate(str, maxLength = 1024) {
    if (!str || typeof str !== 'string') return str;
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}
