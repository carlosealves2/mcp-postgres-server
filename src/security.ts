/**
 * Security validation module for SQL queries
 * Ensures only read-only operations are allowed
 */

import { logger } from './logger';

const BLOCKED_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'REPLACE', 'MERGE', 'GRANT', 'REVOKE',
  'EXEC', 'EXECUTE', 'CALL', 'COPY', 'IMPORT'
];

const BLOCKED_PATTERNS = [
  /;\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/i,
  /INTO\s+OUTFILE/i,
  /LOAD\s+DATA/i,
];

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Normalizes SQL query by removing comments and extra whitespace
 * This helps prevent bypass attempts using comments or encoding
 * @param sql - The SQL query to normalize
 * @returns Normalized SQL query
 */
export function normalizeQuery(sql: string): string {
  let normalized = sql;

  // Remove single-line comments (-- ...)
  normalized = normalized.replace(/--[^\n\r]*/g, ' ');

  // Remove multi-line comments (/* ... */)
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Normalize whitespace (multiple spaces/tabs/newlines to single space)
  normalized = normalized.replace(/\s+/g, ' ');

  // Trim
  normalized = normalized.trim();

  return normalized;
}

/**
 * Validates if a SQL query is read-only (SELECT only)
 * @param sql - The SQL query to validate
 * @returns Validation result with error message if invalid
 */
export function validateReadOnlyQuery(sql: string): ValidationResult {
  if (!sql || typeof sql !== 'string') {
    logger.security('Query validation failed: invalid input type', {
      inputType: typeof sql,
    });
    return {
      isValid: false,
      error: 'SQL query must be a non-empty string'
    };
  }

  // Normalize query to prevent bypass attempts
  const normalizedSql = normalizeQuery(sql);

  if (normalizedSql.length === 0) {
    logger.security('Query validation failed: empty query after normalization');
    return {
      isValid: false,
      error: 'SQL query cannot be empty'
    };
  }

  // Check if query starts with SELECT or WITH (on normalized query)
  const upperSql = normalizedSql.toUpperCase();
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
    logger.security('Query blocked: does not start with SELECT or WITH', {
      queryStart: normalizedSql.substring(0, 50),
    });
    return {
      isValid: false,
      error: 'Only SELECT queries are allowed. Query must start with SELECT or WITH (for CTEs)'
    };
  }

  // Check for blocked keywords in the normalized query
  for (const keyword of BLOCKED_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalizedSql)) {
      logger.security('Query blocked: contains blocked keyword', {
        keyword,
        queryPreview: normalizedSql.substring(0, 100),
      });
      return {
        isValid: false,
        error: `Blocked keyword detected: ${keyword}. Only read-only SELECT queries are allowed`
      };
    }
  }

  // Check for blocked patterns in the normalized query
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalizedSql)) {
      logger.security('Query blocked: matches blocked pattern', {
        pattern: pattern.toString(),
        queryPreview: normalizedSql.substring(0, 100),
      });
      return {
        isValid: false,
        error: 'Query contains blocked pattern. Only read-only SELECT queries are allowed'
      };
    }
  }

  logger.debug('Query validation passed');
  return { isValid: true };
}

/**
 * Configuration for query execution limits
 */
export const QUERY_LIMITS = {
  /** Maximum number of rows to return from a query */
  MAX_ROWS: 1000,

  /** Query timeout in milliseconds (30 seconds) */
  TIMEOUT_MS: 30000,

  /** Maximum query length in characters */
  MAX_QUERY_LENGTH: 10000,
};

/**
 * Validates query length
 * @param sql - The SQL query to validate
 * @returns Validation result
 */
export function validateQueryLength(sql: string): ValidationResult {
  if (sql.length > QUERY_LIMITS.MAX_QUERY_LENGTH) {
    logger.security('Query blocked: exceeds maximum length', {
      queryLength: sql.length,
      maxLength: QUERY_LIMITS.MAX_QUERY_LENGTH,
    });
    return {
      isValid: false,
      error: `Query exceeds maximum length of ${QUERY_LIMITS.MAX_QUERY_LENGTH} characters`
    };
  }

  return { isValid: true };
}

/**
 * Performs all security validations on a SQL query
 * @param sql - The SQL query to validate
 * @returns Validation result with error message if invalid
 */
export function validateQuery(sql: string): ValidationResult {
  // Validate length
  const lengthResult = validateQueryLength(sql);
  if (!lengthResult.isValid) {
    return lengthResult;
  }

  // Validate read-only
  const readOnlyResult = validateReadOnlyQuery(sql);
  if (!readOnlyResult.isValid) {
    return readOnlyResult;
  }

  return { isValid: true };
}
