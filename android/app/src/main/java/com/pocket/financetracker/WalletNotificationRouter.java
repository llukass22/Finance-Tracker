package com.pocket.financetracker;

import java.util.regex.Pattern;

/** Only route Wallet/Google payment notifications; skip Android's group summaries. */
public final class WalletNotificationRouter {
    public static boolean accepts(String source, boolean summary) {
        return !summary && ("com.google.android.apps.walletnfcrel".equals(source)
            || "com.google.android.gms".equals(source));
    }

    public static boolean canImport(String source, String text, String bigText) {
        if ("com.google.android.apps.walletnfcrel".equals(source)) return true;
        // Play services also sends unrelated priced messages. Require payment wording.
        String body = (text == null ? "" : text) + " " + (bigText == null ? "" : bigText);
        return "com.google.android.gms".equals(source) && Pattern.compile(
            "(?i)\\b(?:you paid|you spent|payment|purchase|transaction)\\b|\\bwith\\b.{0,120}\\b(?:card|mastercard|visa)\\b").matcher(body).find();
    }
    public static PurchaseNotificationParser.Result parse(String source, boolean summary,
            String title, String text, String bigText, String subText) {
        if (!accepts(source, summary)) return null;
        return PurchaseNotificationParser.parse(title, text, bigText, subText);
    }

    private WalletNotificationRouter() { }
}
