/**
 * Describe Table Tool - Get detailed schema information for a table
 */

import { waitForDatabase } from '../database';
import { QUERY_LIMITS } from '../security';
import { FORMAT_SCHEMA, type OutputFormat } from '../formatter';

export const DESCRIBE_TABLE_TOOL_DEFINITION = {
  name: 'describe_table',
  description: 'Get detailed schema information about a specific table, including columns, data types, constraints, indexes, and foreign keys.',
  inputSchema: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'The name of the table to describe'
      },
      schema: {
        type: 'string',
        description: 'Optional: The schema name (default: public)'
      },
      format: FORMAT_SCHEMA
    },
    required: ['table']
  }
};

export interface DescribeTableToolInput {
  table: string;
  schema?: string;
  format?: OutputFormat;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
}

export interface IndexInfo {
  indexName: string;
  columnName: string;
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface DescribeTableToolResult {
  success: boolean;
  tableName?: string;
  schema?: string;
  columns?: ColumnInfo[];
  indexes?: IndexInfo[];
  foreignKeys?: ForeignKeyInfo[];
  error?: string;
}

/**
 * Handles the describe_table tool execution
 * @param input - Table name and optional schema
 * @returns Table schema information or error
 */
export async function handleDescribeTableTool(input: DescribeTableToolInput): Promise<DescribeTableToolResult> {
  try {
    // Validate input
    if (!input.table || typeof input.table !== 'string') {
      return {
        success: false,
        error: 'Invalid input: table parameter is required and must be a string'
      };
    }

    const schema = input.schema || 'public';
    const tableName = input.table;
    // Wait for database initialization (handles race condition with MCP client)
    const db = await waitForDatabase();

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout: exceeded ${QUERY_LIMITS.TIMEOUT_MS}ms`));
      }, QUERY_LIMITS.TIMEOUT_MS);
    });

    // Query 1: Get column information using parameterized query
    const columnsPromise = db`
      SELECT
        column_name as "columnName",
        data_type as "dataType",
        is_nullable as "isNullable",
        column_default as "columnDefault",
        character_maximum_length as "characterMaximumLength",
        numeric_precision as "numericPrecision",
        numeric_scale as "numericScale"
      FROM information_schema.columns
      WHERE table_schema = ${schema}
        AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    const columns = await Promise.race([columnsPromise, timeoutPromise]) as any[];

    // Check if table exists
    if (columns.length === 0) {
      return {
        success: false,
        error: `Table '${schema}.${tableName}' not found`
      };
    }

    // Query 2: Get index information using parameterized query
    const indexesPromise = db`
      SELECT
        i.relname as "indexName",
        a.attname as "columnName",
        ix.indisunique as "isUnique",
        ix.indisprimary as "isPrimary"
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = ${schema}
        AND t.relname = ${tableName}
      ORDER BY i.relname, a.attnum
    `;

    const indexes = await Promise.race([indexesPromise, timeoutPromise]) as any[];

    // Query 3: Get foreign key information using parameterized query
    const foreignKeysPromise = db`
      SELECT
        tc.constraint_name as "constraintName",
        kcu.column_name as "columnName",
        ccu.table_name as "referencedTable",
        ccu.column_name as "referencedColumn"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ${schema}
        AND tc.table_name = ${tableName}
      ORDER BY tc.constraint_name
    `;

    const foreignKeys = await Promise.race([foreignKeysPromise, timeoutPromise]) as any[];

    return {
      success: true,
      tableName,
      schema,
      columns: columns as ColumnInfo[],
      indexes: indexes as IndexInfo[],
      foreignKeys: foreignKeys as ForeignKeyInfo[]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}
