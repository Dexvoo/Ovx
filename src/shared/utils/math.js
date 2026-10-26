/**
 * @param {Number} n - Number
 */
function GetOrdinalSuffix(n) {
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;
    if (lastDigit === 1 && lastTwoDigits !== 11) return 'st';
    if (lastDigit === 2 && lastTwoDigits !== 12) return 'nd';
    if (lastDigit === 3 && lastTwoDigits !== 13) return 'rd';
    return 'th';
}

export { GetOrdinalSuffix };
