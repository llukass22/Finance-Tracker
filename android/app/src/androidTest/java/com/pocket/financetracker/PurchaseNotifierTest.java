package com.pocket.financetracker;

import static org.junit.Assert.*;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PurchaseNotifierTest {
    @Test public void showRequestedPreview() {
        org.junit.Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("showPurchasePreview")));
        PurchaseNotifier.createChannel(context());
        assertTrue("Pocket notification sending must be enabled", PurchaseNotifier.enabled(context()));
        Notification preview = Notification.Builder.recoverBuilder(context(), PurchaseNotifier.build(context(), purchase()))
            .setContentTitle("Purchase recorded (test)").build();
        NotificationManager manager = context().getSystemService(NotificationManager.class);
        manager.notify("purchase-preview", 0, preview);
        boolean posted = false;
        for (android.service.notification.StatusBarNotification notification : manager.getActiveNotifications()) {
            if ("purchase-preview".equals(notification.getTag())) posted = true;
        }
        assertTrue("Preview notification should be visible", posted);
    }

    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    private NotificationPurchase purchase() {
        return NotificationPurchase.from(PurchaseNotificationParser.parse("GASTROBARAS +++", "€3.50 with SEB Debit Mastercard", null, null), "notification-test", 1792400000000L);
    }

    @Test public void confirmationContainsExactSavedPurchaseAndOpensPocket() {
        PurchaseNotifier.createChannel(context());
        Notification notification = PurchaseNotifier.build(context(), purchase());
        assertEquals("Purchase recorded", notification.extras.getString(Notification.EXTRA_TITLE));
        String details = notification.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).toString();
        assertTrue(details.contains("GASTROBARAS +++"));
        assertTrue(details.contains("€3.50"));
        assertTrue(details.contains("Category: Eating Out"));
        assertNotNull(notification.contentIntent);
        assertEquals(context().getPackageName(), notification.contentIntent.getCreatorPackage());
        assertEquals(Notification.VISIBILITY_PRIVATE, notification.visibility);
        assertTrue((notification.flags & Notification.FLAG_AUTO_CANCEL) != 0);
    }

    @Test public void duplicatesFailuresAndSkippedImportsNeverNotify() {
        for (String outcome : new String[]{"duplicate", "save_failed", "not_imported", "unsupported_currency"}) {
            assertFalse(PurchaseNotifier.showForOutcome(context(), outcome, purchase()));
        }
        assertFalse(PurchaseNotifier.showForOutcome(context(), "saved", null));
    }

    @Test public void channelIsCreatedIdempotentlyWithoutResettingUserSettings() {
        PurchaseNotifier.createChannel(context());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context().getSystemService(NotificationManager.class);
            NotificationChannel before = manager.getNotificationChannel(PurchaseNotifier.CHANNEL_ID);
            assertNotNull(before);
            PurchaseNotifier.createChannel(context());
            assertEquals(before.getImportance(), manager.getNotificationChannel(PurchaseNotifier.CHANNEL_ID).getImportance());
        }
    }
}
