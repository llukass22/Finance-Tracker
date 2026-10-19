import { Capacitor, registerPlugin } from '@capacitor/core';
import { createPurchaseStorage } from './purchase-storage.mjs';
import { setupNotificationControls } from './notification-controls.mjs';
import { App } from '@capacitor/app';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

if (Capacitor.isNativePlatform()) {
  window.pocketNative = {
    notificationAccess: Capacitor.getPlatform() === 'android'
      ? registerPlugin('NotificationAccess')
      : null,
    purchases: Capacitor.getPlatform() === 'android'
      ? createPurchaseStorage(registerPlugin('PurchaseStorage'), localStorage, `localStorage.v1:${window.location.origin}`)
      : null,
    async exportFile(content, name) {
      const file = await Filesystem.writeFile({
        path: name,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({ title: name, files: [file.uri] });
    },
  };
  if (window.pocketNative.notificationAccess) {
    const refreshPurchases = () => window.dispatchEvent(new Event('pocket-purchases-changed'));
    window.pocketNative.notificationAccess.addListener('purchasesChanged', refreshPurchases).catch(console.error);
    App.addListener('resume', refreshPurchases).catch(console.error);
    setupNotificationControls(window.pocketNative.notificationAccess, App, document).catch(() => {
      document.getElementById('notification-status').textContent = 'Notification controls are unavailable. Reopen Pocket and try again.';
    });
  }
  App.addListener('backButton', async () => {
    const dialog = document.querySelector('dialog[open]');
    if (dialog) {
      dialog.close();
    } else if (!document.getElementById('history').hidden) {
      document.getElementById('overview-tab').click();
    } else {
      await App.minimizeApp();
    }
  }).catch(console.error);
}
