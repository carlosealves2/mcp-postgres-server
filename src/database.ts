/**
 * Database connection pool module using postgres library
 * Manages PostgreSQL connections with pooling
 */

import postgres from 'postgres';
import { loadDatabaseConfig, getConnectionUrl } from './config';
import { QUERY_LIMITS } from './security';
import { logger } from './logger';
import { initializeSSHTunnelIfNeeded, type SSHTunnel } from './ssh-tunnel';

let connectionPool: ReturnType<typeof postgres> | null = null;
let isInitialized = false;
let sshTunnel: SSHTunnel | null = null;
let insecureMode = false;
let initPromise: Promise<void> | null = null;
let initResolve: (() => void) | null = null;
let initReject: ((error: Error) => void) | null = null;

/**
 * Initializes the database connection pool
 * @throws Error if initialization fails
 */
export async function initializeDatabase(): Promise<void> {
  if (isInitialized) {
    logger.debug('Database already initialized');
    return;
  }

  // Create the promise for waitForDatabase() to await
  if (!initPromise) {
    initPromise = new Promise<void>((resolve, reject) => {
      initResolve = resolve;
      initReject = reject;
    });
  }

  try {
    // Initialize SSH tunnel if configured
    sshTunnel = await initializeSSHTunnelIfNeeded();

    const config = loadDatabaseConfig();

    // Store insecure mode flag
    insecureMode = config.insecure;

    // If SSH tunnel is active, connect through it
    const dbHost = sshTunnel ? '127.0.0.1' : config.host;
    const dbPort = sshTunnel ? sshTunnel.localPort : config.port;

    logger.info('Initializing database connection', {
      host: dbHost,
      port: dbPort,
      database: config.database,
      maxConnections: config.maxConnections,
      viaSSHTunnel: !!sshTunnel,
      insecure: insecureMode,
    });

    if (insecureMode) {
      logger.warn('⚠️  INSECURE MODE ENABLED: Write operations (INSERT, UPDATE, DELETE, etc.) are allowed');
      console.error('⚠️  WARNING: INSECURE MODE ENABLED - Write operations are allowed');
    }

    // Initialize postgres with connection config
    connectionPool = postgres({
      host: dbHost,
      port: dbPort,
      database: config.database,
      username: config.username,
      password: config.password,
      max: config.maxConnections,
    });

    // Test connection
    await connectionPool`SELECT 1 as test`;

    isInitialized = true;
    logger.info('Database connected successfully', {
      host: config.host,
      port: config.port,
      database: config.database,
      viaSSHTunnel: !!sshTunnel,
    });

    if (sshTunnel) {
      console.error(`✓ Database connected via SSH tunnel: ${config.host}:${config.port}/${config.database}`);
    } else {
      console.error(`✓ Database connected: ${config.host}:${config.port}/${config.database}`);
    }

    // Resolve the initialization promise
    if (initResolve) {
      initResolve();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize database connection', { error: message });

    // Cleanup SSH tunnel if it was created
    if (sshTunnel) {
      try {
        await sshTunnel.close();
      } catch (closeError) {
        logger.error('Failed to close SSH tunnel during cleanup', {
          error: closeError instanceof Error ? closeError.message : String(closeError)
        });
      }
      sshTunnel = null;
    }

    const initError = new Error(`Failed to initialize database connection: ${message}`);

    // Reject the initialization promise
    if (initReject) {
      initReject(initError);
    }

    throw initError;
  }
}

/**
 * Gets the database connection pool
 * @returns The connection pool
 * @throws Error if pool is not initialized
 */
export function getDatabase() {
  if (!connectionPool || !isInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase() first');
  }
  return connectionPool;
}

/**
 * Waits for database to be initialized with timeout
 * This function resolves the race condition where MCP clients might call tools
 * before the database initialization completes. It waits for the initialization
 * promise to resolve instead of immediately throwing an error.
 *
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @returns The connection pool
 * @throws Error if timeout is reached or initialization fails
 */
export async function waitForDatabase(timeoutMs: number = 10000): Promise<ReturnType<typeof postgres>> {
  // If already initialized, return immediately
  if (isInitialized && connectionPool) {
    return connectionPool;
  }

  // If no initialization promise exists, database initialization was never started
  if (!initPromise) {
    throw new Error('Database initialization not started. Call initializeDatabase() first');
  }

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Database initialization timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    // Wait for initialization to complete or timeout
    await Promise.race([initPromise, timeoutPromise]);

    // Double-check that we have a valid connection pool
    if (!connectionPool) {
      throw new Error('Database initialization completed but connection pool is not available');
    }

    return connectionPool;
  } catch (error) {
    // Re-throw the error with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to wait for database: ${String(error)}`);
  }
}

/**
 * Executes a SQL query with timeout and result limits
 * @param query - The SQL query to execute
 * @returns Query results
 * @throws Error if query fails or times out
 */
export async function executeQuery(query: string): Promise<any[]> {
  const db = getDatabase();
  const startTime = Date.now();

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query timeout: exceeded ${QUERY_LIMITS.TIMEOUT_MS}ms`));
    }, QUERY_LIMITS.TIMEOUT_MS);
  });

  try {
    logger.query('Executing SQL query', {
      queryLength: query.length,
      preview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    });

    // Execute query with timeout
    const queryPromise = db.unsafe(query);
    const results = await Promise.race([queryPromise, timeoutPromise]) as any[];

    const duration = Date.now() - startTime;
    const rowCount = Array.isArray(results) ? results.length : 0;

    // Apply row limit
    if (Array.isArray(results) && results.length > QUERY_LIMITS.MAX_ROWS) {
      logger.warn('Query result limit applied', {
        originalRowCount: results.length,
        limitedRowCount: QUERY_LIMITS.MAX_ROWS,
        duration,
      });
      console.error(`⚠ Query returned ${results.length} rows, limiting to ${QUERY_LIMITS.MAX_ROWS}`);
      return results.slice(0, QUERY_LIMITS.MAX_ROWS);
    }

    logger.query('Query executed successfully', {
      rowCount,
      duration,
    });

    return Array.isArray(results) ? results : [];
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Query execution failed', {
      error: message,
      duration,
      queryLength: query.length,
    });
    throw new Error(`Query execution failed: ${message}`);
  }
}

/**
 * Executes a parameterized query with timeout and result limits
 * Uses postgres template literal syntax for safe parameter binding
 * @param strings - Template literal strings
 * @param values - Parameter values
 * @returns Query results
 * @throws Error if query fails or times out
 */
export async function executeParameterizedQuery(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  const db = getDatabase();

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query timeout: exceeded ${QUERY_LIMITS.TIMEOUT_MS}ms`));
    }, QUERY_LIMITS.TIMEOUT_MS);
  });

  try {
    // Execute parameterized query with timeout using template literal
    const queryPromise = db(strings, ...values);
    const results = await Promise.race([queryPromise, timeoutPromise]) as any[];

    // Apply row limit
    if (Array.isArray(results) && results.length > QUERY_LIMITS.MAX_ROWS) {
      console.error(`⚠ Query returned ${results.length} rows, limiting to ${QUERY_LIMITS.MAX_ROWS}`);
      return results.slice(0, QUERY_LIMITS.MAX_ROWS);
    }

    return Array.isArray(results) ? results : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Query execution failed: ${message}`);
  }
}

/**
 * Closes the database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (connectionPool) {
    logger.info('Closing database connection');
    await connectionPool.end();
    connectionPool = null;
    isInitialized = false;
    logger.info('Database connection closed');
    console.error('✓ Database connection closed');
  }

  // Close SSH tunnel if it exists
  if (sshTunnel) {
    logger.info('Closing SSH tunnel');
    await sshTunnel.close();
    sshTunnel = null;
    logger.info('SSH tunnel closed');
  }
}

/**
 * Checks if database is initialized and connected
 * @returns true if database is ready
 */
export function isDatabaseReady(): boolean {
  return isInitialized && connectionPool !== null;
}

/**
 * Checks if insecure mode is enabled
 * @returns true if insecure mode is enabled (write operations allowed)
 */
export function isInsecureMode(): boolean {
  return insecureMode;
}
