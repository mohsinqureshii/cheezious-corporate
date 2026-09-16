import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * Structured logging.
 *
 * Redaction is configured centrally so that no call site can accidentally leak a
 * password, token, session cookie or applicant CV into the log stream.
 */
const REDACTED_PATHS = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'previewToken',
  'secret',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'body.password',
  'body.currentPassword',
  'body.newPassword',
  'body.token',
  '*.password',
  '*.passwordHash',
  '*.token',
];

export interface CreateLoggerOptions {
  name: string;
  level?: LoggerOptions['level'];
  pretty?: boolean;
  base?: Record<string, unknown>;
}

export function createLogger({ name, level = 'info', pretty = false, base }: CreateLoggerOptions): Logger {
  const options: LoggerOptions = {
    name,
    level,
    base: { service: name, ...base },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service' },
      },
    });
  }

  return pino(options);
}

export type { Logger };

/** A no-op logger for tests and library defaults. */
export const nullLogger: Logger = pino({ level: 'silent' });
