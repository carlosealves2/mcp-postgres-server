/**
 * Query Tool - Execute read-only SQL queries
 */

import { executeQuery, isInsecureMode } from '../database';
import { validateQuery, QUERY_LIMITS } from '../security';
import { FORMAT_SCHEMA, type OutputFormat } from '../formatter';

export const QUERY_TOOL_DEFINITION = {
  name: 'query',
  description: 'Execute a read-only SQL query against the PostgreSQL database. Only SELECT queries are allowed. ' +
    `Results are limited to ${QUERY_LIMITS.MAX_ROWS} rows and queries timeout after ${QUERY_LIMITS.TIMEOUT_MS / 1000} seconds. ` +
    'Supports pagination with limit and offset parameters.',
  inputSchema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'The SQL SELECT query to execute. Must be a read-only query (no INSERT, UPDATE, DELETE, etc.)'
      },
      limit: {
        type: 'number',
        description: `Number of rows to return (default: ${QUERY_LIMITS.MAX_ROWS}, max: ${QUERY_LIMITS.MAX_ROWS})`
      },
      offset: {
        type: 'number',
        description: 'Number of rows to skip for pagination (default: 0)'
      },
      format: FORMAT_SCHEMA
    },
    required: ['sql']
  }
};

export interface QueryToolInput {
  sql: string;
  limit?: number;
  offset?: number;
  format?: OutputFormat;
}

export interface QueryToolResult {
  success: boolean;
  data?: any[];
  rowCount?: number;
  error?: string;
  limitApplied?: boolean;
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Add LIMIT and OFFSET clauses to a SQL query if not already present
 */
function addPaginationToQuery(sql: string, limit: number, offset: number): string {
  const trimmedSql = sql.trim().replace(/;$/, ''); // Remove trailing semicolon
  const upperSql = trimmedSql.toUpperCase();

  // Check if query already has LIMIT or OFFSET
  const hasLimit = /\bLIMIT\s+\d+/i.test(trimmedSql);
  const hasOffset = /\bOFFSET\s+\d+/i.test(trimmedSql);

  if (hasLimit && hasOffset) {
    // Query already has both, return as-is
    return trimmedSql;
  }

  let paginatedSql = trimmedSql;

  if (!hasLimit) {
    paginatedSql += ` LIMIT ${limit}`;
  }

  if (!hasOffset && offset > 0) {
    paginatedSql += ` OFFSET ${offset}`;
  }

  return paginatedSql;
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

    // Validate pagination parameters
    const rawLimit = input.limit ?? QUERY_LIMITS.MAX_ROWS;
    const rawOffset = input.offset ?? 0;

    if (rawLimit <= 0) {
      return {
        success: false,
        error: 'Invalid limit: must be greater than 0'
      };
    }

    if (rawOffset < 0) {
      return {
        success: false,
        error: 'Invalid offset: must be greater than or equal to 0'
      };
    }

    const limit = Math.min(rawLimit, QUERY_LIMITS.MAX_ROWS);
    const offset = rawOffset;

    // Validate query security (pass insecure mode flag)
    const validation = validateQuery(input.sql, isInsecureMode());
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Add pagination to query
    // Fetch limit + 1 to detect if there are more rows
    const paginatedSql = addPaginationToQuery(input.sql, limit + 1, offset);

    // Execute query
    const results = await executeQuery(paginatedSql);

    // Check if there are more rows
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return {
      success: true,
      data,
      rowCount: data.length,
      limitApplied: limit < QUERY_LIMITS.MAX_ROWS,
      pagination: {
        limit,
        offset,
        hasMore
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}
