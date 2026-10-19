export async function setupNotificationControls(access, app, document) {
  const panel = document.getElementById('notification-panel');
  const statusText = document.getElementById('notification-status');
  const preview = document.getElementById('notification-preview');
  const toggle = document.getElementById('notification-toggle');
  const settings = document.getElementById('notification-settings');
  let status = null, busy = false, revision = 0;
  panel.hidden = false;

  async function refresh() {
    const current = ++revision;
    try {
      const [next, snapshot] = await Promise.all([access.getStatus(), access.getLastResult()]);
      if (current !== revision) return;
      status = next;
      statusText.textContent = !next.enabled ? 'Off' : !next.accessGranted
        ? 'Notification access required' : next.connected ? 'Listening for Wallet notifications' : 'Connecting to Android…';
      toggle.textContent = next.enabled && next.accessGranted ? 'Turn off' : 'Enable notification access';
      toggle.disabled = settings.disabled = busy;
      const parsed = next.enabled ? snapshot.result : null;
      const amount = parsed?.status === 'parsed' ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: parsed.currency }).format(parsed.cents / 100) : '';
      preview.textContent = parsed?.importStatus === 'saved'
        ? `Purchase saved: ${parsed.merchant} · ${amount} · ${parsed.category}.`
        : parsed?.importStatus === 'duplicate' ? 'This notification was already processed. No duplicate purchase added.'
        : parsed?.importStatus === 'save_failed' ? 'The purchase could not be saved. Check device storage and add it manually if needed.'
        : parsed?.importStatus === 'unsupported_currency' ? 'This purchase uses another currency. Add it manually in EUR.'
        : parsed ? 'This notification needs review or is not a completed purchase. No purchase added.' : 'No notification processed in this session.';
    } catch {
      if (current === revision) statusText.textContent = 'Could not check notification access. Reopen Pocket and try again.';
    }
  }

  async function change(openSettings) {
    if (busy) return;
    busy = true;
    toggle.disabled = settings.disabled = true;
    try {
      if (openSettings || !status?.enabled || !status?.accessGranted) {
        await access.setEnabled({ enabled: true });
        await access.openSettings();
      } else {
        await access.setEnabled({ enabled: false });
      }
      await refresh();
    } catch {
      statusText.textContent = 'Could not change notification access. Please try again.';
    } finally {
      busy = false;
      toggle.disabled = settings.disabled = false;
    }
  }

  toggle.addEventListener('click', () => change(false));
  settings.addEventListener('click', () => change(true));
  await access.addListener('notificationParsed', refresh);
  await access.addListener('listenerStatusChanged', refresh);
  await app.addListener('resume', refresh);
  await refresh();
}
