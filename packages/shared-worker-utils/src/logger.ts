import type { LogEntry } from './types'

/**
 * Base class providing structured logging functionality
 */
export abstract class Logger {
  protected onLog?: (logEntry: LogEntry) => void

  /**
   * Get the prefix for log messages (e.g., "[PortManager]", "[SharedWorkerClient]")
   */
  protected abstract getLogPrefix(): string

  /**
   * Log a message with optional context
   */
  protected log(
    message: string,
    level: LogEntry['level'],
    context?: Record<string, unknown>
  ): void {
    this.onLog?.({
      message: `${this.getLogPrefix()} ${message}`,
      level,
      ...(context !== undefined && { context }),
    })
  }
}
