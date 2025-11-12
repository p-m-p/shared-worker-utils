---
'shared-worker-utils': major
---

BREAKING CHANGE: Refactor logging to use structured format

The `onLog` callback now receives a structured `LogEntry` object instead of string arguments, enabling better integration with logging systems and improved queryability.

**Migration Guide:**

Before:
```typescript
new PortManager({
  onLog: (message, ...args) => {
    console.log(message, ...args)
  }
})
```

After:
```typescript
new PortManager({
  onLog: (logEntry) => {
    // logEntry has: message, level, context?
    console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.message}`)
  }
})
```

**What Changed:**
- Added `LogEntry` interface: `{ message: string, level: LogLevel, context?: Record<string, unknown> }`
- Added `LogLevel` type: `'info' | 'debug' | 'warn' | 'error'`
- `onLog` signature changed from `(message: string, ...parameters: unknown[]) => void` to `(logEntry: LogEntry) => void`
- Context data now in separate field (e.g., `{ totalClients: 1 }`, `{ visible: false }`)
- Log levels assigned: `'info'` for state changes, `'debug'` for routine operations

**Benefits:**
- Structured logging with typed fields for better tooling support
- Easy integration with log aggregators and monitoring systems
- Context data in separate field for better queryability
- Consistent log format across all library messages
- Type-safe logging with full TypeScript support
