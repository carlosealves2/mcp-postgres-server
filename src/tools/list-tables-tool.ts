/**
 * List Tables Tool - List all tables in the database
 */

import { getDatabase } from '../database';
import { QUERY_LIMITS } from '../security';
import { FORMAT_SCHEMA, type OutputFormat } from '../formatter';

export const LIST_TABLES_TOOL_DEFINITION = {
  name: 'list_tables',
  description: 'List all tables in the PostgreSQL database. Returns table names, schemas, and types (BASE TABLE or VIEW).',
  inputSchema: {
    type: 'object',
    properties: {
      schema: {
        type: 'string',
        description: 'Optional: Filter tables by schema name (default: public)'
      },
      format: FORMAT_SCHEMA
    }
  }
};

export interface ListTablesToolInput {
  schema?: string;
  format?: OutputFormat;
}

export interface TableInfo {
  schema: string;
  tableName: string;
  tableType: string;
}

export interface ListTablesToolResult {
  success: boolean;
  tables?: TableInfo[];
  tableCount?: number;
  error?: string;
}

/**
 * Handles the list_tables tool execution
 * @param input - Optional schema filter
 * @returns List of tables or error
 */
export async function handleListTablesTool(input: ListTablesToolInput = {}): Promise<ListTablesToolResult> {
  try {
    const schema = input.schema || 'public';
    const db = getDatabase();

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout: exceeded ${QUERY_LIMITS.TIMEOUT_MS}ms`));
      }, QUERY_LIMITS.TIMEOUT_MS);
    });

    // Execute parameterized query to list all tables in the specified schema
    // Using template literal syntax for safe parameter binding
    const queryPromise = db`
      SELECT
        table_schema as schema,
        table_name as "tableName",
        table_type as "tableType"
      FROM information_schema.tables
      WHERE table_schema = ${schema}
      ORDER BY table_schema, table_name
    `;

    const results = await Promise.race([queryPromise, timeoutPromise]) as any[];

    return {
      success: true,
      tables: results as TableInfo[],
      tableCount: results.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}
