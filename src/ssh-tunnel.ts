/**
 * SSH Tunnel module for secure database connections
 * Allows connecting to PostgreSQL through an SSH bastion/jump host
 */

import { Client } from 'ssh2';
import { createServer, Socket } from 'net';
import { logger } from './logger';
import { readFileSync } from 'fs';

export interface SSHTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  // Authentication methods (mutually exclusive)
  password?: string;
  privateKeyPath?: string;
  privateKey?: string;
  passphrase?: string;
  // Target database
  targetHost: string;
  targetPort: number;
  // Local port to forward to (0 = random available port)
  localPort?: number;
}

export interface SSHTunnel {
  localPort: number;
  close: () => Promise<void>;
}

/**
 * Loads SSH tunnel configuration from environment variables
 * @returns SSH tunnel config or null if SSH is disabled
 */
export function loadSSHTunnelConfig(): SSHTunnelConfig | null {
  const enabled = process.env.SSH_TUNNEL_ENABLED === 'true';

  if (!enabled) {
    return null;
  }

  // Validate required SSH parameters
  const requiredVars = ['SSH_HOST', 'SSH_USERNAME'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `SSH tunnel enabled but missing required variables: ${missing.join(', ')}`
    );
  }

  // At least one authentication method is required
  if (!process.env.SSH_PASSWORD && !process.env.SSH_PRIVATE_KEY_PATH && !process.env.SSH_PRIVATE_KEY) {
    throw new Error(
      'SSH tunnel requires at least one authentication method: ' +
      'SSH_PASSWORD, SSH_PRIVATE_KEY_PATH, or SSH_PRIVATE_KEY'
    );
  }

  const config: SSHTunnelConfig = {
    enabled: true,
    host: process.env.SSH_HOST!,
    port: parseInt(process.env.SSH_PORT || '22', 10),
    username: process.env.SSH_USERNAME!,
    password: process.env.SSH_PASSWORD,
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH,
    privateKey: process.env.SSH_PRIVATE_KEY,
    passphrase: process.env.SSH_PASSPHRASE,
    targetHost: process.env.POSTGRES_HOST || 'localhost',
    targetPort: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    localPort: parseInt(process.env.SSH_LOCAL_PORT || '0', 10),
  };

  // Validate port
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid SSH_PORT: ${process.env.SSH_PORT}. Must be between 1 and 65535`);
  }

  return config;
}

/**
 * Creates an SSH tunnel to the database server
 * @param config - SSH tunnel configuration
 * @returns Promise resolving to tunnel info with local port
 */
export async function createSSHTunnel(config: SSHTunnelConfig): Promise<SSHTunnel> {
  return new Promise((resolve, reject) => {
    const sshClient = new Client();
    let localServer: ReturnType<typeof createServer> | null = null;
    let isReady = false;

    logger.info('Creating SSH tunnel', {
      sshHost: config.host,
      sshPort: config.port,
      sshUser: config.username,
      targetHost: config.targetHost,
      targetPort: config.targetPort,
      authMethod: config.privateKeyPath ? 'privateKey' : config.privateKey ? 'privateKey (env)' : 'password',
    });

    // Prepare SSH authentication
    const sshConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
    };

    // Load private key if specified
    if (config.privateKeyPath) {
      try {
        sshConfig.privateKey = readFileSync(config.privateKeyPath, 'utf8');
        if (config.passphrase) {
          sshConfig.passphrase = config.passphrase;
        }
        logger.debug('Loaded SSH private key from file', { path: config.privateKeyPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to load SSH private key', { path: config.privateKeyPath, error: message });
        reject(new Error(`Failed to load SSH private key: ${message}`));
        return;
      }
    } else if (config.privateKey) {
      sshConfig.privateKey = config.privateKey;
      if (config.passphrase) {
        sshConfig.passphrase = config.passphrase;
      }
      logger.debug('Using SSH private key from environment variable');
    } else if (config.password) {
      sshConfig.password = config.password;
      logger.debug('Using SSH password authentication');
    }

    // Create local server for port forwarding
    localServer = createServer((localSocket: Socket) => {
      logger.debug('Local connection established, forwarding through SSH');

      sshClient.forwardOut(
        '127.0.0.1',
        0,
        config.targetHost,
        config.targetPort,
        (err, sshStream) => {
          if (err) {
            logger.error('SSH port forwarding failed', { error: err.message });
            localSocket.end();
            return;
          }

          logger.debug('SSH stream established, piping data');
          localSocket.pipe(sshStream);
          sshStream.pipe(localSocket);

          localSocket.on('error', (error) => {
            logger.debug('Local socket error', { error: error.message });
          });

          sshStream.on('error', (error: Error) => {
            logger.debug('SSH stream error', { error: error.message });
          });
        }
      );
    });

    // Handle SSH connection events
    sshClient
      .on('ready', () => {
        logger.info('SSH connection established');
        isReady = true;

        // Start local server
        localServer!.listen(config.localPort || 0, '127.0.0.1', () => {
          const address = localServer!.address();
          const localPort = typeof address === 'object' && address ? address.port : 0;

          logger.info('SSH tunnel created successfully', {
            localPort,
            targetHost: config.targetHost,
            targetPort: config.targetPort,
          });

          resolve({
            localPort,
            close: async () => {
              logger.info('Closing SSH tunnel');
              return new Promise<void>((resolveClose) => {
                if (localServer) {
                  localServer.close(() => {
                    logger.debug('Local server closed');
                  });
                }
                sshClient.end();
                resolveClose();
              });
            },
          });
        });

        localServer!.on('error', (error) => {
          logger.error('Local server error', { error: error.message });
          if (!isReady) {
            reject(error);
          }
        });
      })
      .on('error', (error) => {
        logger.error('SSH connection error', { error: error.message });
        if (localServer) {
          localServer.close();
        }
        reject(new Error(`SSH connection failed: ${error.message}`));
      })
      .on('close', () => {
        logger.info('SSH connection closed');
      })
      .connect(sshConfig);
  });
}

/**
 * Creates SSH tunnel if enabled in configuration
 * @returns Tunnel instance or null if SSH is disabled
 */
export async function initializeSSHTunnelIfNeeded(): Promise<SSHTunnel | null> {
  const config = loadSSHTunnelConfig();

  if (!config || !config.enabled) {
    logger.debug('SSH tunnel disabled');
    return null;
  }

  logger.info('SSH tunnel enabled, creating tunnel...');
  return await createSSHTunnel(config);
}
