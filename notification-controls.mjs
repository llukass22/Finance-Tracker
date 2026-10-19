export async function setupNotificationControls(access, app, document) {
  const panel = document.getElementById('notification-panel');
  const statusText = document.getElementById('notification-status');
  const preview = document.getElementById('notification-preview');
  const toggle = document.getElementById('notification-toggle');
  const settings = document.getElementById('notification-settings');
  const alertsStatus = document.getElementById('purchase-notification-status');
  const alertsEnable = document.getElementById('purchase-notification-enable');
  const alertsSettings = document.getElementById('purchase-notification-settings');
  let status = null, sending = null, busy = false, alertsBusy = false, revision = 0;
  panel.hidden = false;

  async function refresh() {
    const current = ++revision;
    try {
      const [next, snapshot, nextSending] = await Promise.all([access.getStatus(), access.getLastResult(), access.getPurchaseNotificationStatus()]);
      if (current !== revision) return;
      status = next;
      sending = nextSending;
      alertsStatus.textContent = nextSending.enabled ? 'Purchase notifications are on.' : 'Purchase notifications are off. Automatic recording still works.';
      alertsEnable.hidden = nextSending.enabled;
      alertsEnable.textContent = nextSending.permissionGranted ? 'Enable in Android settings' : 'Enable purchase notifications';
      alertsEnable.disabled = alertsSettings.disabled = alertsBusy;
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
  async function changeSending(openSettings) {
    if (alertsBusy) return;
    alertsBusy = true;
    alertsEnable.disabled = alertsSettings.disabled = true;
    try {
      if (openSettings || sending?.permissionGranted) await access.openPurchaseNotificationSettings();
      else await access.requestPurchaseNotifications();
      await refresh();
    } catch {
      alertsStatus.textContent = 'Could not enable purchase notifications. Try Notification settings.';
    } finally {
      alertsBusy = false;
      alertsEnable.disabled = alertsSettings.disabled = false;
    }
  }
  alertsEnable.addEventListener('click', () => changeSending(false));
  alertsSettings.addEventListener('click', () => changeSending(true));
  await access.addListener('notificationParsed', refresh);
  await access.addListener('listenerStatusChanged', refresh);
  await app.addListener('resume', refresh);
  await refresh();
}
