import { describe, it, expect } from 'vitest';
import { success, error, notFound, badRequest } from '../../src/shared/middleware/response';

describe('response helpers', () => {
  describe('success', () => {
    it('returns 200 with JSON body', () => {
      const result = success({ players: [], count: 0 });
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body as string)).toEqual({ players: [], count: 0 });
    });

    it('includes CORS and content-type headers', () => {
      const result = success({});
      const headers = result.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
    });

    it('accepts a custom status code', () => {
      const result = success({ created: true }, 201);
      expect(result.statusCode).toBe(201);
    });
  });

  describe('error', () => {
    it('returns 500 by default', () => {
      const result = error('Something went wrong');
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body as string)).toEqual({ error: 'Something went wrong' });
    });

    it('accepts a custom status code', () => {
      const result = error('Forbidden', 403);
      expect(result.statusCode).toBe(403);
    });
  });

  describe('notFound', () => {
    it('returns 404 with default message', () => {
      const result = notFound();
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body as string)).toEqual({ error: 'Not found' });
    });

    it('returns 404 with custom message', () => {
      const result = notFound('Player not found');
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body as string)).toEqual({ error: 'Player not found' });
    });
  });

  describe('badRequest', () => {
    it('returns 400 with default message', () => {
      const result = badRequest();
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({ error: 'Bad request' });
    });

    it('returns 400 with custom message', () => {
      const result = badRequest('Invalid position');
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body as string)).toEqual({ error: 'Invalid position' });
    });
  });
});
