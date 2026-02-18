/**
 * Parse a string query parameter as an integer with bounds checking.
 * Returns the parsed value, or undefined if the raw value is absent.
 * Throws a ValidationError if the value is present but invalid.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parseIntParam(
  raw: string | undefined,
  name: string,
  opts: { min?: number; max?: number; defaultValue?: number } = {},
): number | undefined {
  if (raw === undefined || raw === '') {
    return opts.defaultValue;
  }

  const parsed = parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    throw new ValidationError(`${name} must be a valid integer`);
  }

  if (opts.min !== undefined && parsed < opts.min) {
    throw new ValidationError(`${name} must be at least ${opts.min}`);
  }

  if (opts.max !== undefined && parsed > opts.max) {
    throw new ValidationError(`${name} must be at most ${opts.max}`);
  }

  return parsed;
}
