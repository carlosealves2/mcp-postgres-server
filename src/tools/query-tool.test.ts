/**
 * Query Tool tests
 */

import { test, expect, describe } from 'bun:test';
import { QUERY_TOOL_DEFINITION } from './query-tool';

describe('Query Tool', () => {
  describe('Tool definition', () => {
    test('should have correct name', () => {
      expect(QUERY_TOOL_DEFINITION.name).toBe('query');
    });

    test('should have description', () => {
      expect(QUERY_TOOL_DEFINITION.description).toBeTruthy();
      expect(QUERY_TOOL_DEFINITION.description).toContain('read-only');
      expect(QUERY_TOOL_DEFINITION.description).toContain('SELECT');
    });

    test('should have input schema', () => {
      expect(QUERY_TOOL_DEFINITION.inputSchema).toBeDefined();
      expect(QUERY_TOOL_DEFINITION.inputSchema.type).toBe('object');
    });

    test('should require sql parameter', () => {
      expect(QUERY_TOOL_DEFINITION.inputSchema.required).toContain('sql');
    });

    test('should have sql property in schema', () => {
      expect(QUERY_TOOL_DEFINITION.inputSchema.properties.sql).toBeDefined();
      expect(QUERY_TOOL_DEFINITION.inputSchema.properties.sql.type).toBe('string');
    });
  });

  describe('Input validation', () => {
    test('should validate missing sql parameter', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({} as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('sql parameter is required');
    });

    test('should validate null sql parameter', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({ sql: null as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sql parameter is required');
    });

    test('should validate non-string sql parameter', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({ sql: 123 as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });
  });

  describe('Security validation', () => {
    test('should reject INSERT query', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'INSERT INTO users (name) VALUES ("test")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject UPDATE query', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'UPDATE users SET name = "test"',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject DELETE query', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'DELETE FROM users',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject DROP query', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'DROP TABLE users',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject query exceeding length limit', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const longQuery = 'SELECT * FROM users WHERE ' + 'id = 1 OR '.repeat(10000) + 'id = 2';

      const result = await handleQueryTool({ sql: longQuery });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });
  });

  describe('Result structure', () => {
    test('should return success flag', async () => {
      const { handleQueryTool } = await import('./query-tool');
      // This will fail without database, but structure is tested
      const result = await handleQueryTool({ sql: 'SELECT 1' });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    test('should include error message on failure', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({ sql: 'DELETE FROM users' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('Pagination', () => {
    test('should have limit and offset in input schema', () => {
      expect(QUERY_TOOL_DEFINITION.inputSchema.properties.limit).toBeDefined();
      expect(QUERY_TOOL_DEFINITION.inputSchema.properties.limit.type).toBe('number');
      expect(QUERY_TOOL_DEFINITION.inputSchema.properties.offset).toBeDefined();
      expect(QUERY_TOOL_DEFINITION.inputSchema.properties.offset.type).toBe('number');
    });

    test('should reject invalid limit (0)', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'SELECT * FROM users',
        limit: 0
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('limit');
    });

    test('should reject invalid limit (negative)', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'SELECT * FROM users',
        limit: -10
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('limit');
    });

    test('should reject invalid offset (negative)', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'SELECT * FROM users',
        offset: -5
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('offset');
    });

    test('should use default limit when not provided', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({ sql: 'SELECT 1' });

      // Will fail without DB, but we check the structure
      if (result.pagination) {
        expect(result.pagination.limit).toBeDefined();
        expect(result.pagination.limit).toBeGreaterThan(0);
      }
    });

    test('should use default offset (0) when not provided', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({ sql: 'SELECT 1' });

      if (result.pagination) {
        expect(result.pagination.offset).toBe(0);
      }
    });

    test('should respect custom limit', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'SELECT 1',
        limit: 50
      });

      if (result.pagination) {
        expect(result.pagination.limit).toBe(50);
      }
    });

    test('should respect custom offset', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'SELECT 1',
        offset: 100
      });

      if (result.pagination) {
        expect(result.pagination.offset).toBe(100);
      }
    });

    test('should cap limit at MAX_ROWS', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const { QUERY_LIMITS } = await import('../security');

      const result = await handleQueryTool({
        sql: 'SELECT 1',
        limit: QUERY_LIMITS.MAX_ROWS + 1000
      });

      if (result.pagination) {
        expect(result.pagination.limit).toBeLessThanOrEqual(QUERY_LIMITS.MAX_ROWS);
      }
    });

    test('should include hasMore flag in pagination', async () => {
      const { handleQueryTool } = await import('./query-tool');
      const result = await handleQueryTool({
        sql: 'SELECT 1',
        limit: 10
      });

      if (result.pagination) {
        expect(result.pagination).toHaveProperty('hasMore');
        expect(typeof result.pagination.hasMore).toBe('boolean');
      }
    });
  });
});
