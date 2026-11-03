package com.pocket.financetracker;

import java.util.regex.Pattern;

/** Route supported payment notifications and skip group summaries. */
public final class WalletNotificationRouter {
    private static final String SEB_LIETUVA = "se.seb.lithuania";
    private static final String SWEDBANK_LIETUVA = "lt.swedbank.mobile";

    public static boolean accepts(String source, boolean summary) {
        return !summary && ("com.google.android.apps.walletnfcrel".equals(source)
            || "com.google.android.gms".equals(source) || SEB_LIETUVA.equals(source) || SWEDBANK_LIETUVA.equals(source));
    }

    public static boolean canImport(String source, String text, String bigText) {
        // The dedicated bank parsers require outgoing-payment wording.
        if ("com.google.android.apps.walletnfcrel".equals(source)
                || SEB_LIETUVA.equals(source) || SWEDBANK_LIETUVA.equals(source)) return true;
        // Play services also sends unrelated priced messages. Require payment wording.
        String body = (text == null ? "" : text) + " " + (bigText == null ? "" : bigText);
        return "com.google.android.gms".equals(source) && Pattern.compile(
            "(?i)\\b(?:you paid|you spent|payment|purchase|transaction)\\b|\\bwith\\b.{0,120}\\b(?:card|mastercard|visa)\\b").matcher(body).find();
    }
    public static PurchaseNotificationParser.Result parse(String source, boolean summary,
            String title, String text, String bigText, String subText) {
        if (!accepts(source, summary)) return null;
        if (SEB_LIETUVA.equals(source)) return PurchaseNotificationParser.parseSeb(title, text, bigText, subText);
        if (SWEDBANK_LIETUVA.equals(source)) return PurchaseNotificationParser.parseSwedbank(text, bigText);
        return PurchaseNotificationParser.parse(title, text, bigText, subText);
    }

    private WalletNotificationRouter() { }
}
