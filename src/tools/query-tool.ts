/**
 * Query Tool - Execute read-only SQL queries
 */

import { executeQuery } from '../database';
import { validateQuery, QUERY_LIMITS } from '../security';
import { FORMAT_SCHEMA, type OutputFormat } from '../formatter';

export const QUERY_TOOL_DEFINITION = {
  name: 'query',
  description: 'Execute a read-only SQL query against the PostgreSQL database. Only SELECT queries are allowed. ' +
    `Results are limited to ${QUERY_LIMITS.MAX_ROWS} rows and queries timeout after ${QUERY_LIMITS.TIMEOUT_MS / 1000} seconds.`,
  inputSchema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'The SQL SELECT query to execute. Must be a read-only query (no INSERT, UPDATE, DELETE, etc.)'
      },
      format: FORMAT_SCHEMA
    },
    required: ['sql']
  }
};

export interface QueryToolInput {
  sql: string;
  format?: OutputFormat;
}

export interface QueryToolResult {
  success: boolean;
  data?: any[];
  rowCount?: number;
  error?: string;
  limitApplied?: boolean;
}

/**
 * Handles the query tool execution
 * @param input - Query tool input with SQL query
 * @returns Query results or error
 */
export async function handleQueryTool(input: QueryToolInput): Promise<QueryToolResult> {
  try {
    // Validate input
    if (!input.sql || typeof input.sql !== 'string') {
      return {
        success: false,
        error: 'Invalid input: sql parameter is required and must be a string'
      };
    }

    // Validate query security
    const validation = validateQuery(input.sql);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Execute query
    const results = await executeQuery(input.sql);

    // Check if limit was applied
    const limitApplied = results.length === QUERY_LIMITS.MAX_ROWS;

    return {
      success: true,
      data: results,
      rowCount: results.length,
      limitApplied
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}
