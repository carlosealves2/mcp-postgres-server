#!/usr/bin/env bun

/**
 * MCP Server for PostgreSQL - Read-Only Database Access
 *
 * This server provides secure read-only access to PostgreSQL databases
 * through the Model Context Protocol (MCP).
 *
 * Configuration: Set connection details in .mcp.json env section
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { initializeDatabase, closeDatabase } from './src/database';
import {
  QUERY_TOOL_DEFINITION,
  handleQueryTool,
  type QueryToolInput
} from './src/tools/query-tool';
import {
  LIST_TABLES_TOOL_DEFINITION,
  handleListTablesTool,
  type ListTablesToolInput
} from './src/tools/list-tables-tool';
import {
  DESCRIBE_TABLE_TOOL_DEFINITION,
  handleDescribeTableTool,
  type DescribeTableToolInput
} from './src/tools/describe-table-tool';
import { formatOutput, type OutputFormat } from './src/formatter';

// Create MCP server instance
const server = new Server(
  {
    name: 'postgres-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      QUERY_TOOL_DEFINITION,
      LIST_TABLES_TOOL_DEFINITION,
      DESCRIBE_TABLE_TOOL_DEFINITION,
    ],
  };
});

/**
 * Handler for tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query': {
        const input = args as unknown as QueryToolInput;
        const result = await handleQueryTool(input);

        if (!result.success) {
          throw new McpError(ErrorCode.InternalError, result.error || 'Query failed');
        }

        const outputData = {
          rowCount: result.rowCount,
          limitApplied: result.limitApplied,
          data: result.data
        };

        return {
          content: [
            {
              type: 'text',
              text: formatOutput(outputData, input.format || 'TOON')
            }
          ]
        };
      }

      case 'list_tables': {
        const input = args as ListTablesToolInput;
        const result = await handleListTablesTool(input);

        if (!result.success) {
          throw new McpError(ErrorCode.InternalError, result.error || 'Failed to list tables');
        }

        const outputData = {
          tableCount: result.tableCount,
          tables: result.tables
        };

        return {
          content: [
            {
              type: 'text',
              text: formatOutput(outputData, input.format || 'TOON')
            }
          ]
        };
      }

      case 'describe_table': {
        const input = args as unknown as DescribeTableToolInput;
        const result = await handleDescribeTableTool(input);

        if (!result.success) {
          throw new McpError(ErrorCode.InternalError, result.error || 'Failed to describe table');
        }

        const outputData = {
          schema: result.schema,
          tableName: result.tableName,
          columns: result.columns,
          indexes: result.indexes,
          foreignKeys: result.foreignKeys
        };

        return {
          content: [
            {
              type: 'text',
              text: formatOutput(outputData, input.format || 'TOON')
            }
          ]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
  }
});

/**
 * Main function - Initialize and start the MCP server
 */
async function main() {
  try {
    // Initialize database connection
    console.error('Initializing PostgreSQL connection...');
    await initializeDatabase();

    // Create stdio transport for MCP communication
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.error('✓ PostgreSQL MCP server running on stdio');
    console.error('✓ Ready to accept connections from Claude or other MCP clients');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Failed to start server: ${message}`);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
  console.error('\nShutting down server...');
  try {
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
