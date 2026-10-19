package com.pocket.financetracker;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.os.Bundle;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Parse new Wallet notifications and atomically save categorized EUR purchases. */
public class PocketNotificationListener extends NotificationListenerService {
    private static volatile boolean connected;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PurchaseDatabase database;

    @Override public void onCreate() {
        super.onCreate();
        database = new PurchaseDatabase(this);
    }

    static boolean isConnected() { return connected; }

    @Override public void onListenerConnected() {
        super.onListenerConnected();
        connected = true;
        NotificationAccessPlugin.connectionChanged();
    }

    @Override public void onListenerDisconnected() {
        connected = false;
        NotificationAccessPlugin.connectionChanged();
        super.onListenerDisconnected();
    }

    @Override public void onDestroy() {
        connected = false;
        NotificationAccessPlugin.connectionChanged();
        worker.execute(() -> database.close());
        worker.shutdown();
        super.onDestroy();
    }

    @Override public void onNotificationPosted(StatusBarNotification notification) {
        int state = getPackageManager().getComponentEnabledSetting(new ComponentName(this, PocketNotificationListener.class));
        if (!connected || state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                || state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER || notification == null) return;
        Notification content = notification.getNotification();
        if (content == null) return;
        boolean summary = (content.flags & Notification.FLAG_GROUP_SUMMARY) != 0;
        if (!WalletNotificationRouter.accepts(notification.getPackageName(), summary)) return;
        Bundle extras = content.extras;
        String title = text(extras, Notification.EXTRA_TITLE), body = text(extras, Notification.EXTRA_TEXT),
            expanded = text(extras, Notification.EXTRA_BIG_TEXT), subText = text(extras, Notification.EXTRA_SUB_TEXT);
        String source = notification.getPackageName(), key = notification.getKey();
        long eventTime = content.when > 0 ? content.when : notification.getPostTime();
        worker.execute(() -> {
            int enabled = getPackageManager().getComponentEnabledSetting(new ComponentName(this, PocketNotificationListener.class));
            if (!connected || enabled == PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                    || enabled == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER) return;
            PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(source, false, title, body, expanded, subText);
            NotificationPurchase purchase = WalletNotificationRouter.canImport(source, body, expanded)
                ? NotificationPurchase.from(parsed, key, eventTime) : null;
            String outcome = "parsed".equals(parsed.status) && !"EUR".equals(parsed.currency) ? "unsupported_currency" : "not_imported";
            try {
                if (purchase != null) outcome = database.importNotification(purchase);
            } catch (Exception failure) {
                // No success receipt is committed on failure; a repeated alert can retry.
                outcome = "save_failed";
            }
            PurchaseNotifier.showForOutcome(this, outcome, purchase);
            NotificationAccessPlugin.parsed(parsed, outcome, purchase);
        });
    }

    private static String text(Bundle extras, String key) {
        Object value = extras == null ? null : extras.get(key);
        return value instanceof CharSequence ? value.toString() : null;
    }
}
