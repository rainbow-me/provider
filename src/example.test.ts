import { add } from './example';
import { expect, test } from 'vitest';

test('adds 1 + 2 to equal 3', () => {
  expect(add(1, 2)).toBe(3);
});
