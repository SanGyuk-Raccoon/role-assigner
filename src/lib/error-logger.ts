/**
 * Error logging utility with categorization and GA4 integration
 */

// Error categories
export type ErrorCategory =
  | 'network'      // Network/connection issues
  | 'room'         // Room-related errors (not found, full, expired)
  | 'validation'   // User input validation errors
  | 'server'       // Server-side errors
  | 'client'       // Client-side errors
  | 'unknown';     // Unclassified errors

// Error severity levels
export type ErrorSeverity =
  | 'info'      // Informational (user mistakes, expected errors)
  | 'warning'   // Warnings (recoverable issues)
  | 'error'     // Errors (needs attention)
  | 'critical'; // Critical errors (service disruption)

export interface ErrorLogEntry {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

// GA4 event parameters type
interface GA4ErrorEventParams {
  event_category: string;
  error_code: string;
  error_message: string;
  error_severity: string;
  page_location?: string;
}

// Global gtag type declaration
declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: string,
      params: GA4ErrorEventParams
    ) => void;
  }
}

/**
 * Log error to console with structured format
 */
function logToConsole(entry: ErrorLogEntry): void {
  const prefix = `[${entry.category.toUpperCase()}]`;
  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  }[entry.severity];

  const logMethod = {
    info: console.info,
    warning: console.warn,
    error: console.error,
    critical: console.error,
  }[entry.severity];

  logMethod(
    `${severityEmoji} ${prefix} [${entry.code}] ${entry.message}`,
    entry.context ? { context: entry.context } : ''
  );
}

/**
 * Send error event to Google Analytics 4
 */
function sendToGA4(entry: ErrorLogEntry): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  // Only log warnings and above to GA4 to avoid noise
  if (entry.severity === 'info') {
    return;
  }

  try {
    window.gtag('event', 'error_occurred', {
      event_category: entry.category,
      error_code: entry.code,
      error_message: entry.message.substring(0, 100), // Truncate for GA4
      error_severity: entry.severity,
      page_location: entry.url,
    });
  } catch {
    // Silently fail if GA4 logging fails
  }
}

/**
 * Main error logging function
 */
export function logError(
  category: ErrorCategory,
  severity: ErrorSeverity,
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    category,
    severity,
    code,
    message,
    context,
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  // Always log to console in development
  if (process.env.NODE_ENV === 'development') {
    logToConsole(entry);
  }

  // Send to GA4 in production
  if (process.env.NODE_ENV === 'production') {
    sendToGA4(entry);
  }

  return entry;
}

// Convenience functions for common error types

export function logNetworkError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  return logError('network', 'error', code, message, context);
}

export function logRoomError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  // Room errors are usually user-recoverable
  const severity = code === 'ROOM_EXPIRED' ? 'warning' : 'info';
  return logError('room', severity, code, message, context);
}

export function logValidationError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  return logError('validation', 'info', code, message, context);
}

export function logServerError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  return logError('server', 'error', code, message, context);
}

export function logCriticalError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  return logError('unknown', 'critical', code, message, context);
}
