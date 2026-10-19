package com.pocket.financetracker;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Validated EUR purchase intent; its ID is stable across repeated notification updates. */
public final class NotificationPurchase {
    public final String id, category, merchant, date;
    public final long cents, createdAt;

    private NotificationPurchase(String id, String category, String merchant, String date, long cents, long createdAt) {
        this.id = id; this.category = category; this.merchant = merchant; this.date = date;
        this.cents = cents; this.createdAt = createdAt;
    }

    public static NotificationPurchase from(PurchaseNotificationParser.Result parsed, String notificationKey, long eventTime) {
        if (parsed == null || !"parsed".equals(parsed.status) || !"EUR".equals(parsed.currency)
                || parsed.cents == null || parsed.cents <= 0 || parsed.cents > 99999999999L
                || parsed.merchant == null || parsed.merchant.isEmpty() || parsed.merchant.length() > 200
                || notificationKey == null || notificationKey.isEmpty() || eventTime <= 0) return null;
        String date = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date(eventTime));
        if (!date.matches("\\d{4}-\\d{2}-\\d{2}")) return null;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((notificationKey + "\n" + eventTime).getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder();
            for (byte value : digest) hash.append(String.format(Locale.ROOT, "%02x", value & 255));
            return new NotificationPurchase("wallet-" + hash, MerchantCategory.categorize(parsed.merchant), parsed.merchant, date, parsed.cents, eventTime);
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
