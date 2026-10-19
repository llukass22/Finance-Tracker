package com.pocket.financetracker;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** Listener foundation only: no notification contents are retained or processed. */
public class PocketNotificationListener extends NotificationListenerService {
    private static volatile boolean connected;

    static boolean isConnected() { return connected; }

    @Override public void onListenerConnected() {
        super.onListenerConnected();
        connected = true;
    }

    @Override public void onListenerDisconnected() {
        connected = false;
        super.onListenerDisconnected();
    }

    @Override public void onDestroy() {
        connected = false;
        super.onDestroy();
    }

    @Override public void onNotificationPosted(StatusBarNotification notification) {
        // Purchase filtering, parsing, and database writes will be implemented separately.
    }
}
