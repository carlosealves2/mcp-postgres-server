/**
 * Configuration module for PostgreSQL connection
 * Reads configuration from environment variables
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  maxConnections: number;
  insecure: boolean;
}

/**
 * Loads database configuration from environment variables
 * @returns Database configuration object
 * @throws Error if required environment variables are missing
 */
export function loadDatabaseConfig(): DatabaseConfig {
  const requiredVars = [
    'POSTGRES_HOST',
    'POSTGRES_DATABASE',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD'
  ];

  // Check for missing required variables
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please configure these in your .mcp.json file or .env file'
    );
  }

  const config: DatabaseConfig = {
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE!,
    username: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10', 10),
    insecure: process.env.POSTGRES_INSECURE === 'true',
  };

  // Validate port number
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid POSTGRES_PORT: ${process.env.POSTGRES_PORT}. Must be between 1 and 65535`);
  }

  // Validate max connections
  if (isNaN(config.maxConnections) || config.maxConnections < 1) {
    throw new Error(`Invalid POSTGRES_MAX_CONNECTIONS: ${process.env.POSTGRES_MAX_CONNECTIONS}. Must be at least 1`);
  }

  return config;
}

/**
 * Gets a connection URL for PostgreSQL
 * @param config - Database configuration
 * @returns PostgreSQL connection URL
 */
export function getConnectionUrl(config: DatabaseConfig): string {
  return `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
}
