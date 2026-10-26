import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetOrdinalSuffix } from '../src/shared/utils/math.js';
import { Truncate } from '../src/shared/utils/string.js';

test('GetOrdinalSuffix handles teens and repeating suffixes', () => {
    const cases = {
        1: 'st',
        2: 'nd',
        3: 'rd',
        4: 'th',
        11: 'th',
        12: 'th',
        13: 'th',
        21: 'st',
        22: 'nd',
        101: 'st',
        111: 'th',
        112: 'th',
    };
    for (const [n, suffix] of Object.entries(cases)) assert.equal(GetOrdinalSuffix(Number(n)), suffix, `n = ${n}`);
});

test('Truncate shortens to maxLength including the ellipsis', () => {
    assert.equal(Truncate('hello', 10), 'hello');
    assert.equal(Truncate('hello world', 8), 'hello...');
    assert.equal(Truncate('hello world', 8).length, 8);
    assert.equal(Truncate('x'.repeat(2000)).length, 1024);
});

test('Truncate passes through non-strings', () => {
    assert.equal(Truncate(undefined), undefined);
    assert.equal(Truncate(''), '');
});
