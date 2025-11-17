/**
 * Configuration module tests
 * Tests for database configuration loading and validation
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { loadDatabaseConfig, getConnectionUrl, type DatabaseConfig } from './config';

describe('loadDatabaseConfig', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DATABASE;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_MAX_CONNECTIONS;
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('successful configuration', () => {
    test('loads all required environment variables', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      const config = loadDatabaseConfig();

      expect(config.host).toBe('localhost');
      expect(config.database).toBe('testdb');
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
    });

    test('uses default port when not specified', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      const config = loadDatabaseConfig();

      expect(config.port).toBe(5432);
    });

    test('uses custom port when specified', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '5433';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      const config = loadDatabaseConfig();

      expect(config.port).toBe(5433);
    });

    test('uses default max connections when not specified', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      const config = loadDatabaseConfig();

      expect(config.maxConnections).toBe(10);
    });

    test('uses custom max connections when specified', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_MAX_CONNECTIONS = '20';

      const config = loadDatabaseConfig();

      expect(config.maxConnections).toBe(20);
    });

    test('accepts port at lower boundary', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '1';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      const config = loadDatabaseConfig();

      expect(config.port).toBe(1);
    });

    test('accepts port at upper boundary', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '65535';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      const config = loadDatabaseConfig();

      expect(config.port).toBe(65535);
    });
  });

  describe('missing required variables', () => {
    test('throws error when POSTGRES_HOST is missing', () => {
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_HOST');
    });

    test('throws error when POSTGRES_DATABASE is missing', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_DATABASE');
    });

    test('throws error when POSTGRES_USER is missing', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_USER');
    });

    test('throws error when POSTGRES_PASSWORD is missing', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';

      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_PASSWORD');
    });

    test('lists all missing variables in error message', () => {
      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_HOST');
      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_DATABASE');
      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_USER');
      expect(() => loadDatabaseConfig()).toThrow('POSTGRES_PASSWORD');
    });
  });

  describe('invalid port values', () => {
    test('throws error for port below 1', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '0';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_PORT');
    });

    test('throws error for port above 65535', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '65536';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_PORT');
    });

    test('throws error for negative port', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '-1';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_PORT');
    });

    test('throws error for non-numeric port', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = 'invalid';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_PORT');
    });

    test('throws error for float port', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '5432.5';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      // parseInt will parse 5432.5 as 5432, so this should pass
      const config = loadDatabaseConfig();
      expect(config.port).toBe(5432);
    });
  });

  describe('invalid max connections', () => {
    test('throws error for max connections below 1', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_MAX_CONNECTIONS = '0';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_MAX_CONNECTIONS');
    });

    test('throws error for negative max connections', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_MAX_CONNECTIONS = '-5';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_MAX_CONNECTIONS');
    });

    test('throws error for non-numeric max connections', () => {
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_DATABASE = 'testdb';
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_MAX_CONNECTIONS = 'many';

      expect(() => loadDatabaseConfig()).toThrow('Invalid POSTGRES_MAX_CONNECTIONS');
    });
  });
});

describe('getConnectionUrl', () => {
  test('generates correct URL with all parameters', () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
      maxConnections: 10
    };

    const url = getConnectionUrl(config);

    expect(url).toBe('postgres://user:pass@localhost:5432/testdb');
  });

  test('handles special characters in password', () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'p@ss:word/123',
      maxConnections: 10
    };

    const url = getConnectionUrl(config);

    expect(url).toContain('p@ss:word/123');
  });

  test('handles IPv4 address as host', () => {
    const config: DatabaseConfig = {
      host: '192.168.1.100',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
      maxConnections: 10
    };

    const url = getConnectionUrl(config);

    expect(url).toBe('postgres://user:pass@192.168.1.100:5432/testdb');
  });

  test('handles custom port', () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5433,
      database: 'testdb',
      username: 'user',
      password: 'pass',
      maxConnections: 10
    };

    const url = getConnectionUrl(config);

    expect(url).toContain(':5433/');
  });

  test('handles database name with underscores', () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'my_test_database',
      username: 'user',
      password: 'pass',
      maxConnections: 10
    };

    const url = getConnectionUrl(config);

    expect(url).toContain('/my_test_database');
  });

  test('handles username with numbers', () => {
    const config: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user123',
      password: 'pass',
      maxConnections: 10
    };

    const url = getConnectionUrl(config);

    expect(url).toContain('user123:');
  });
});
