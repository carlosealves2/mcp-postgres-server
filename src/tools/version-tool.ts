/**
 * Version Tool - Get MCP server version information
 */

import { FORMAT_SCHEMA, type OutputFormat } from '../formatter';

export const VERSION_TOOL_DEFINITION = {
  name: 'version',
  description: 'Get the version information of the PostgreSQL MCP server.',
  inputSchema: {
    type: 'object',
    properties: {
      format: FORMAT_SCHEMA
    }
  }
};

export interface VersionToolInput {
  format?: OutputFormat;
}

export interface VersionToolResult {
  success: boolean;
  name?: string;
  version?: string;
  description?: string;
  error?: string;
}

/**
 * Handles the version tool execution
 * @param input - Optional format parameter
 * @returns Version information or error
 */
export async function handleVersionTool(input: VersionToolInput = {}): Promise<VersionToolResult> {
  try {
    // Import package.json to get version info
    const packageJson = require('../../package.json');

    return {
      success: true,
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to retrieve version information: ${message}`
    };
  }
}