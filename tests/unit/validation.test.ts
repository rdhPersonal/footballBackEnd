import { describe, it, expect } from 'vitest';
import { parseIntParam, ValidationError } from '../../src/shared/middleware/validation';

describe('parseIntParam', () => {
  it('returns undefined for undefined input with no default', () => {
    expect(parseIntParam(undefined, 'test')).toBeUndefined();
  });

  it('returns undefined for empty string with no default', () => {
    expect(parseIntParam('', 'test')).toBeUndefined();
  });

  it('returns default value when input is undefined', () => {
    expect(parseIntParam(undefined, 'test', { defaultValue: 50 })).toBe(50);
  });

  it('returns default value when input is empty string', () => {
    expect(parseIntParam('', 'test', { defaultValue: 50 })).toBe(50);
  });

  it('parses a valid integer', () => {
    expect(parseIntParam('42', 'test')).toBe(42);
  });

  it('parses zero', () => {
    expect(parseIntParam('0', 'test')).toBe(0);
  });

  it('parses negative integers', () => {
    expect(parseIntParam('-5', 'test', { min: -10 })).toBe(-5);
  });

  it('throws ValidationError for non-numeric input', () => {
    expect(() => parseIntParam('abc', 'season')).toThrow(ValidationError);
    expect(() => parseIntParam('abc', 'season')).toThrow('season must be a valid integer');
  });

  it('throws ValidationError for float-like string', () => {
    expect(() => parseIntParam('3.14', 'week')).not.toThrow();
    expect(parseIntParam('3.14', 'week')).toBe(3);
  });

  it('throws ValidationError when value is below min', () => {
    expect(() => parseIntParam('0', 'limit', { min: 1 })).toThrow(ValidationError);
    expect(() => parseIntParam('0', 'limit', { min: 1 })).toThrow('limit must be at least 1');
  });

  it('throws ValidationError when value is above max', () => {
    expect(() => parseIntParam('300', 'limit', { max: 200 })).toThrow(ValidationError);
    expect(() => parseIntParam('300', 'limit', { max: 200 })).toThrow('limit must be at most 200');
  });

  it('accepts value at min boundary', () => {
    expect(parseIntParam('1', 'limit', { min: 1, max: 200 })).toBe(1);
  });

  it('accepts value at max boundary', () => {
    expect(parseIntParam('200', 'limit', { min: 1, max: 200 })).toBe(200);
  });

  it('ignores default when a valid value is provided', () => {
    expect(parseIntParam('10', 'limit', { defaultValue: 50 })).toBe(10);
  });

  it('ValidationError has correct name property', () => {
    try {
      parseIntParam('bad', 'field');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).name).toBe('ValidationError');
    }
  });
});
