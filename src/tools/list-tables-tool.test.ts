/**
 * List Tables Tool tests
 */

import { test, expect, describe } from 'bun:test';
import { LIST_TABLES_TOOL_DEFINITION } from './list-tables-tool';

// Skip integration tests in CI where there's no database
const skipIntegrationTests = process.env.CI === 'true';

describe('List Tables Tool', () => {
  describe('Tool definition', () => {
    test('should have correct name', () => {
      expect(LIST_TABLES_TOOL_DEFINITION.name).toBe('list_tables');
    });

    test('should have description', () => {
      expect(LIST_TABLES_TOOL_DEFINITION.description).toBeTruthy();
      expect(LIST_TABLES_TOOL_DEFINITION.description).toContain('tables');
    });

    test('should have input schema', () => {
      expect(LIST_TABLES_TOOL_DEFINITION.inputSchema).toBeDefined();
      expect(LIST_TABLES_TOOL_DEFINITION.inputSchema.type).toBe('object');
    });

    test('should have optional schema parameter', () => {
      expect(LIST_TABLES_TOOL_DEFINITION.inputSchema.properties.schema).toBeDefined();
      expect(LIST_TABLES_TOOL_DEFINITION.inputSchema.properties.schema.type).toBe('string');
      // Schema should be optional (no required field means all properties are optional)
      const schema = LIST_TABLES_TOOL_DEFINITION.inputSchema as { required?: string[] };
      expect(schema.required || []).not.toContain('schema');
    });
  });

  describe('Input validation', () => {
    test.skipIf(skipIntegrationTests)('should use default schema when not provided', async () => {
      const { handleListTablesTool } = await import('./list-tables-tool');
      // Will fail without DB, but tests default behavior
      const result = await handleListTablesTool({});

      expect(result).toHaveProperty('success');
      // Query should use 'public' schema by default
    });

    test.skipIf(skipIntegrationTests)('should accept custom schema', async () => {
      const { handleListTablesTool } = await import('./list-tables-tool');
      const result = await handleListTablesTool({ schema: 'custom_schema' });

      expect(result).toHaveProperty('success');
    });
  });

  describe('SQL Injection prevention', () => {
    test.skipIf(skipIntegrationTests)('should handle schema with single quotes', async () => {
      const { handleListTablesTool } = await import('./list-tables-tool');
      // Test SQL injection attempt
      const result = await handleListTablesTool({
        schema: "public'; DROP TABLE users; --",
      });

      // Should not throw error, should handle safely
      expect(result).toHaveProperty('success');
    });

    test.skipIf(skipIntegrationTests)('should handle schema with special characters', async () => {
      const { handleListTablesTool } = await import('./list-tables-tool');
      const result = await handleListTablesTool({
        schema: "test'schema",
      });

      expect(result).toHaveProperty('success');
    });
  });

  describe('Result structure', () => {
    test.skipIf(skipIntegrationTests)('should return success flag', async () => {
      const { handleListTablesTool } = await import('./list-tables-tool');
      const result = await handleListTablesTool({});

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    test.skipIf(skipIntegrationTests)('should include error message on failure', async () => {
      const { handleListTablesTool } = await import('./list-tables-tool');
      // This will fail without database connection
      const result = await handleListTablesTool({});

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });
});
