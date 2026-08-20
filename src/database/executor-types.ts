// Low-level SQL executor interface shared by the native (expo-sqlite) and web
// (sql.js) drivers. Repositories are written ONCE against this interface using
// parameterized queries; Metro resolves the platform-specific implementation.

export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlExecutor {
  /** Execute one or more statements with NO parameters (DDL / PRAGMA / batch). */
  execAsync(sql: string): Promise<void>;
  /** Execute a single write statement with bound parameters. */
  runAsync(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Read all rows for a query. */
  getAllAsync<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Read the first row (or null). */
  getFirstAsync<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Run a callback inside a single transaction (auto BEGIN/COMMIT/ROLLBACK). */
  withTransactionAsync(cb: () => Promise<void>): Promise<void>;
  /** Read PRAGMA user_version (schema version marker). */
  getUserVersion(): Promise<number>;
  /** Write PRAGMA user_version. */
  setUserVersion(version: number): Promise<void>;
}

export type ExecutorFactory = () => Promise<SqlExecutor>;
