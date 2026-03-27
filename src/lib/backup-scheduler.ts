let started = false;
export function startBackupScheduler(_intervalMs = 5 * 60 * 1000) {
  if (started) return;
  started = true;
}
