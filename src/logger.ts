/**
 * Structured logging system for MCP Database Client
 * Provides consistent logging across the application with different levels
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Read log level from environment variable, default to INFO
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    this.minLevel = this.parseLogLevel(envLevel) || LogLevel.INFO;
  }

  private parseLogLevel(level?: string): LogLevel | null {
    switch (level) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return null;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.minLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatLog(entry: LogEntry): string {
    // For structured logging, output as JSON
    if (process.env.LOG_FORMAT === 'json') {
      return JSON.stringify(entry);
    }

    // For human-readable format
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    const formatted = this.formatLog(entry);

    // Log to stderr (MCP uses stdout for protocol communication)
    console.error(formatted);
  }

  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log security-related events (query blocks, validation failures, etc.)
   */
  security(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, `[SECURITY] ${message}`, context);
  }

  /**
   * Log query execution (for audit trail)
   */
  query(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, `[QUERY] ${message}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();
