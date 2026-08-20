import { relTime } from "../lib/date";
import "./SyncStatus.css";

export type SyncState = "idle" | "syncing" | "error" | "no-token";

interface SyncStatusProps {
  status: SyncState;
  lastSyncedAt: number | null;
  onRetry: () => void;
}

/** Small always-visible indicator of whether sync is actually working —
 * added after a misconfigured gate made sync() silently no-op forever on
 * the deployed site (the empty-string API_URL that's correct there was
 * being read as "no backend configured"). Nothing failed loudly; nothing
 * in the UI said so either. This exists so that class of bug is visible
 * without reading Lambda logs. */
export function SyncStatus({ status, lastSyncedAt, onRetry }: SyncStatusProps) {
  const label =
    status === "syncing"
      ? "Syncing…"
      : status === "error"
        ? "Sync failed — tap to retry"
        : status === "no-token"
          ? "Not synced — tap to enter token"
          : lastSyncedAt
            ? `Synced ${relTime(new Date(lastSyncedAt).toISOString())}`
            : "Not synced yet";

  const clickable = status === "error" || status === "no-token";

  return (
    <div className={`sync-status sync-status--${status}`} onClick={clickable ? onRetry : undefined}>
      <span className="sync-dot" />
      {label}
    </div>
  );
}
