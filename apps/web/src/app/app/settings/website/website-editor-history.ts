export const WEBSITE_EDITOR_RESTORE_EVENT_TYPE = 'petcare:website-editor-restore';
export const WEBSITE_EDITOR_HISTORY_EVENT_TYPE = 'petcare:website-editor-history';
export const WEBSITE_EDITOR_APPLY_SNAPSHOT_EVENT_TYPE = 'petcare:website-editor-apply-snapshot';

export type WebsiteEditorSnapshot = Record<string, string[]>;

export type WebsiteEditorHistory = {
  entries: WebsiteEditorSnapshot[];
  index: number;
};

export function createWebsiteEditorSnapshot(formData: FormData): WebsiteEditorSnapshot {
  const snapshot: WebsiteEditorSnapshot = {};
  formData.forEach((value, key) => {
    if (typeof value !== 'string') return;
    snapshot[key] = [...(snapshot[key] ?? []), value];
  });
  return snapshot;
}

export function serializeWebsiteEditorSnapshot(snapshot: WebsiteEditorSnapshot) {
  return JSON.stringify(
    Object.keys(snapshot)
      .sort()
      .map((key) => [key, snapshot[key]]),
  );
}

export function appendWebsiteEditorSnapshot(
  history: WebsiteEditorHistory,
  snapshot: WebsiteEditorSnapshot,
  limit = 50,
): WebsiteEditorHistory {
  if (
    serializeWebsiteEditorSnapshot(history.entries[history.index] ?? {}) ===
    serializeWebsiteEditorSnapshot(snapshot)
  ) {
    return history;
  }

  const entries = [...history.entries.slice(0, history.index + 1), snapshot].slice(-limit);
  return { entries, index: entries.length - 1 };
}

export function readWebsiteEditorSnapshotValue(snapshot: WebsiteEditorSnapshot, name: string) {
  return snapshot[name]?.[0] ?? '';
}
