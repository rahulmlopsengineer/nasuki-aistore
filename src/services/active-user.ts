// Holds the id of the currently-authenticated LOCAL user. Services read this
// to scope all SQLite queries so one account can never see another's data.
// Set by AuthService on login/restore and cleared on logout.

let _activeUserId: string | null = null;

export function setActiveUserId(id: string | null): void {
  _activeUserId = id;
}

export function getActiveUserId(): string | null {
  return _activeUserId;
}

export function requireActiveUserId(): string {
  if (!_activeUserId) throw new Error("No authenticated user");
  return _activeUserId;
}
