/**
 * Security validation tests
 * Tests for SQL query validation and security measures
 */

import { test, expect, describe } from 'bun:test';
import {
  normalizeQuery,
  validateReadOnlyQuery,
  validateQueryLength,
  validateQuery,
  QUERY_LIMITS,
} from './security';

describe('normalizeQuery', () => {
  test('removes single-line comments', () => {
    const query = 'SELECT * FROM users -- this is a comment';
    const normalized = normalizeQuery(query);
    expect(normalized).toBe('SELECT * FROM users');
  });

  test('removes multi-line comments', () => {
    const query = 'SELECT /* comment */ * FROM users';
    const normalized = normalizeQuery(query);
    expect(normalized).toBe('SELECT * FROM users');
  });

  test('normalizes whitespace', () => {
    const query = 'SELECT    *   FROM\n\tusers  WHERE   id = 1';
    const normalized = normalizeQuery(query);
    expect(normalized).toBe('SELECT * FROM users WHERE id = 1');
  });

  test('trims leading and trailing whitespace', () => {
    const query = '  SELECT * FROM users  ';
    const normalized = normalizeQuery(query);
    expect(normalized).toBe('SELECT * FROM users');
  });

  test('handles complex query with multiple comment types', () => {
    const query = `
      SELECT /* get all */ *
      FROM users -- main table
      WHERE active = true /* filter */
    `;
    const normalized = normalizeQuery(query);
    expect(normalized).toBe('SELECT * FROM users WHERE active = true');
  });

  test('handles empty string', () => {
    const normalized = normalizeQuery('');
    expect(normalized).toBe('');
  });

  test('handles only comments', () => {
    const query = '-- just a comment\n/* another comment */';
    const normalized = normalizeQuery(query);
    expect(normalized).toBe('');
  });

  test('handles nested-like multi-line comments', () => {
    const query = 'SELECT * /* outer /* inner */ still outer */ FROM users';
    const normalized = normalizeQuery(query);
    expect(normalized).toContain('SELECT *');
  });
});

describe('validateReadOnlyQuery', () => {
  describe('Valid queries', () => {
    test('should accept simple SELECT query', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should accept SELECT with WHERE clause', () => {
      const result = validateReadOnlyQuery('SELECT id, name FROM users WHERE age > 18');
      expect(result.isValid).toBe(true);
    });

    test('should accept SELECT with JOIN', () => {
      const result = validateReadOnlyQuery(
        'SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id'
      );
      expect(result.isValid).toBe(true);
    });

    test('should accept WITH (CTE) queries', () => {
      const result = validateReadOnlyQuery(
        'WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM active_users'
      );
      expect(result.isValid).toBe(true);
    });

    test('should accept query with subqueries', () => {
      const result = validateReadOnlyQuery(
        'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)'
      );
      expect(result.isValid).toBe(true);
    });

    test('should accept query with leading whitespace', () => {
      const result = validateReadOnlyQuery('  \n\t  SELECT * FROM users');
      expect(result.isValid).toBe(true);
    });

    test('should accept case-insensitive SELECT', () => {
      const result = validateReadOnlyQuery('select * from users');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid queries - Empty/null', () => {
    test('should reject empty string', () => {
      const result = validateReadOnlyQuery('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject whitespace-only string', () => {
      const result = validateReadOnlyQuery('   \n\t  ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject non-string input', () => {
      const result = validateReadOnlyQuery(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a non-empty string');
    });
  });

  describe('Invalid queries - Blocked keywords', () => {
    test('should reject INSERT query', () => {
      const result = validateReadOnlyQuery('INSERT INTO users (name) VALUES ("test")');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject UPDATE query', () => {
      const result = validateReadOnlyQuery('UPDATE users SET name = "test" WHERE id = 1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject DELETE query', () => {
      const result = validateReadOnlyQuery('DELETE FROM users WHERE id = 1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject DROP query', () => {
      const result = validateReadOnlyQuery('DROP TABLE users');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject ALTER query', () => {
      const result = validateReadOnlyQuery('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject CREATE query', () => {
      const result = validateReadOnlyQuery('CREATE TABLE test (id INT)');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject TRUNCATE query', () => {
      const result = validateReadOnlyQuery('TRUNCATE TABLE users');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject GRANT query', () => {
      const result = validateReadOnlyQuery('GRANT ALL ON users TO admin');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject REVOKE query', () => {
      const result = validateReadOnlyQuery('REVOKE ALL ON users FROM admin');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject EXEC query', () => {
      const result = validateReadOnlyQuery('EXEC sp_executesql @query');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject EXECUTE query', () => {
      const result = validateReadOnlyQuery('EXECUTE sp_executesql @query');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('SQL Injection attempts', () => {
    test('should reject query with semicolon and INSERT', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users; INSERT INTO users VALUES (1)');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject query with semicolon and DELETE', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users; DELETE FROM users');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject query with semicolon and DROP', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users; DROP TABLE users');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject INTO OUTFILE', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users INTO OUTFILE "/tmp/users.txt"');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });

    test('should reject LOAD DATA', () => {
      const result = validateReadOnlyQuery('LOAD DATA INFILE "/tmp/users.txt" INTO TABLE users');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject case-insensitive injection attempts', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users; insert INTO users VALUES (1)');
      expect(result.isValid).toBe(false);
    });

    test('should reject query starting with comment and INSERT', () => {
      const result = validateReadOnlyQuery('/* comment */ INSERT INTO users VALUES (1)');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only SELECT queries');
    });
  });

  describe('Edge cases', () => {
    test('should reject query not starting with SELECT or WITH', () => {
      const result = validateReadOnlyQuery('EXPLAIN SELECT * FROM users');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only SELECT queries');
    });

    test('should block SELECT with string containing blocked keywords', () => {
      const result = validateReadOnlyQuery(
        "SELECT * FROM users WHERE name = 'INSERT'"
      );
      // This is blocked by the keyword check (may need refinement in production)
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should detect blocked keywords in lowercase', () => {
      const result = validateReadOnlyQuery('select * from users; insert into users values (1)');
      expect(result.isValid).toBe(false);
    });

    test('should detect blocked keywords with mixed case', () => {
      const result = validateReadOnlyQuery('SELECT * FROM users; InSeRt INTO users VALUES (1)');
      expect(result.isValid).toBe(false);
    });
  });
});

describe('validateQueryLength', () => {
  test('should accept query within limit', () => {
    const result = validateQueryLength('SELECT * FROM users');
    expect(result.isValid).toBe(true);
  });

  test('should accept query at exact limit', () => {
    const query = 'A'.repeat(QUERY_LIMITS.MAX_QUERY_LENGTH);
    const result = validateQueryLength(query);
    expect(result.isValid).toBe(true);
  });

  test('should reject query exceeding limit', () => {
    const query = 'A'.repeat(QUERY_LIMITS.MAX_QUERY_LENGTH + 1);
    const result = validateQueryLength(query);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain(`exceeds maximum length`);
    expect(result.error).toContain(String(QUERY_LIMITS.MAX_QUERY_LENGTH));
  });

  test('should reject very long query', () => {
    const query = 'SELECT * FROM users WHERE ' + 'id = 1 OR '.repeat(10000) + 'id = 2';
    const result = validateQueryLength(query);
    expect(result.isValid).toBe(false);
  });
});

describe('validateQuery (combined)', () => {
  test('should accept valid SELECT query', () => {
    const result = validateQuery('SELECT * FROM users WHERE age > 18');
    expect(result.isValid).toBe(true);
  });

  test('should reject query that is too long', () => {
    const query = 'SELECT * FROM users WHERE ' + 'id = 1 OR '.repeat(10000) + 'id = 2';
    const result = validateQuery(query);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  test('should reject INSERT even if length is valid', () => {
    const result = validateQuery('INSERT INTO users (name) VALUES ("test")');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should reject empty query', () => {
    const result = validateQuery('');
    expect(result.isValid).toBe(false);
  });

  test('should perform both validations in order (length first)', () => {
    // Create a query that is both too long AND has blocked keyword
    const longBadQuery = 'A'.repeat(QUERY_LIMITS.MAX_QUERY_LENGTH + 1) + ' INSERT INTO users VALUES (1)';
    const result = validateQuery(longBadQuery);
    expect(result.isValid).toBe(false);
    // Should fail on length check first
    expect(result.error).toContain('exceeds maximum length');
  });
});

describe('QUERY_LIMITS constants', () => {
  test('should have reasonable MAX_ROWS', () => {
    expect(QUERY_LIMITS.MAX_ROWS).toBe(1000);
    expect(QUERY_LIMITS.MAX_ROWS).toBeGreaterThan(0);
  });

  test('should have reasonable TIMEOUT_MS', () => {
    expect(QUERY_LIMITS.TIMEOUT_MS).toBe(30000);
    expect(QUERY_LIMITS.TIMEOUT_MS).toBeGreaterThan(0);
  });

  test('should have reasonable MAX_QUERY_LENGTH', () => {
    expect(QUERY_LIMITS.MAX_QUERY_LENGTH).toBe(10000);
    expect(QUERY_LIMITS.MAX_QUERY_LENGTH).toBeGreaterThan(0);
  });
});
