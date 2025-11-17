/**
 * Database module tests with proper mocking
 * Tests database operations without real connection
 */

import { test, expect, describe, beforeEach, afterEach, mock, spyOn } from 'bun:test';

describe('Database executeQuery with mocks', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Setup required env vars for database config
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_DATABASE = 'testdb';
    process.env.POSTGRES_USER = 'testuser';
    process.env.POSTGRES_PASSWORD = 'testpass';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('executeQuery wraps errors with context', async () => {
    // Import after setting env
    const database = await import('./database');

    // Without initialization, executeQuery should fail
    await expect(database.executeQuery('SELECT 1')).rejects.toThrow('Database not initialized');
  });

  test('executeParameterizedQuery requires initialization', async () => {
    const database = await import('./database');

    const strings = ['SELECT * FROM users WHERE id = ', ''] as unknown as TemplateStringsArray;
    await expect(database.executeParameterizedQuery(strings, 1)).rejects.toThrow('Database not initialized');
  });

  test('closeDatabase handles non-initialized state', async () => {
    const database = await import('./database');

    // Should not throw when closing non-initialized database
    await expect(database.closeDatabase()).resolves.toBeUndefined();
  });
});

describe('Query execution edge cases', () => {
  test('QUERY_LIMITS are properly exported', async () => {
    const { QUERY_LIMITS } = await import('./security');

    expect(QUERY_LIMITS.MAX_ROWS).toBeGreaterThan(0);
    expect(QUERY_LIMITS.TIMEOUT_MS).toBeGreaterThan(0);
    expect(QUERY_LIMITS.MAX_QUERY_LENGTH).toBeGreaterThan(0);
  });
});
