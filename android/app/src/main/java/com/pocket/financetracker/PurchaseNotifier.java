package com.pocket.financetracker;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Currency;
import java.util.Locale;

/** Confirmation delivery is separate from the already-committed purchase. */
public final class PurchaseNotifier {
    static final String CHANNEL_ID = "automatic_purchases";

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                context.getString(R.string.purchase_notification_channel), NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription(context.getString(R.string.purchase_notification_channel_description));
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    static boolean permissionGranted(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean enabled(Context context) {
        if (!permissionGranted(context) || !NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = context.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL_ID);
            return channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }

    static Notification build(Context context, NotificationPurchase purchase) {
        NumberFormat money = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IE"));
        money.setCurrency(Currency.getInstance("EUR"));
        String details = purchase.merchant + " · " + money.format(BigDecimal.valueOf(purchase.cents, 2));
        String category = context.getString(R.string.purchase_notification_category, purchase.category);
        Intent open = new Intent(context, MainActivity.class)
            .setAction("com.pocket.financetracker.PURCHASE_RECORDED")
            .setData(Uri.parse("pocket://purchase/" + purchase.id))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_purchase_notification)
            .setContentTitle(context.getString(R.string.purchase_notification_title))
            .setContentText(details + " · " + category)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(details + "\n" + category))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setDefaults(NotificationCompat.DEFAULT_SOUND)
            .build();
    }

    static boolean showForOutcome(Context context, String outcome, NotificationPurchase purchase) {
        if (!"saved".equals(outcome) || purchase == null) return false;
        try {
            createChannel(context);
            if (!enabled(context)) return false;
            NotificationManagerCompat.from(context).notify(purchase.id, 0, build(context, purchase));
            return true;
        } catch (RuntimeException unavailable) {
            // The expense remains saved even if Android refuses notification delivery.
            return false;
        }
    }

    private PurchaseNotifier() { }
}
