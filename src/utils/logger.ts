/**
 * Logger interface for the Huefy SDK.
 *
 * All SDK components accept an optional logger to enable
 * structured diagnostic output without coupling to console.
 */

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Logger that writes to the console.
 *
 * Each method delegates to the corresponding `console.*` call,
 * prefixing the message with a `[huefy]` tag for easy filtering.
 */
export class ConsoleLogger implements Logger {
  private readonly prefix = '[huefy]';

  debug(message: string, ...args: unknown[]): void {
    console.debug(`${this.prefix} ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(`${this.prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }
}

/**
 * Silent logger that discards all output.
 *
 * Useful as the default when the caller does not supply a logger,
 * avoiding `if (logger)` guards throughout the codebase.
 */
export class NoopLogger implements Logger {
  debug(_message: string, ..._args: unknown[]): void {
    // intentionally empty
  }

  info(_message: string, ..._args: unknown[]): void {
    // intentionally empty
  }

  warn(_message: string, ..._args: unknown[]): void {
    // intentionally empty
  }

  error(_message: string, ..._args: unknown[]): void {
    // intentionally empty
  }
}

export interface CreateLoggerOptions {
  /** When true the returned logger writes to the console; otherwise it is silent. */
  debug?: boolean;
}

/**
 * Factory that returns a {@link ConsoleLogger} when `debug` is true,
 * or a {@link NoopLogger} otherwise.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return options.debug ? new ConsoleLogger() : new NoopLogger();
}
