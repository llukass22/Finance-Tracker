package com.pocket.financetracker;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Currency;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure text interpretation. No access to notifications, files, or the purchase database. */
public final class PurchaseNotificationParser {
    private static final String CODE = "EUR|USD|GBP|PLN|RUB|CHF|CAD|AUD|SEK|NOK|DKK|CZK|HUF|RON|BGN|TRY|UAH|JPY|CNY|INR|BRL|NZD|SGD|HKD";
    private static final String UNIT = "(?:€|£|₽|\\$|(?<![A-Za-z])(?:" + CODE + ")(?![A-Za-z]))";
    private static final String NUMBER = "[0-9]+(?:[., ][0-9]+)*";
    private static final Pattern MONEY = Pattern.compile("(" + UNIT + ")\\s*([+-]?" + NUMBER + ")|([+-]?" + NUMBER + ")\\s*(" + UNIT + ")", Pattern.CASE_INSENSITIVE);
    private static final Pattern NON_PURCHASE = Pattern.compile("\\b(declined|failed|cancelled|canceled|refunded?|refunds|reversed|reversal|cashback|verification|one.time (?:code|password)|OTP)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern UNCERTAIN = Pattern.compile("\\b(pending|pre.?authori[sz](?:ation|ed)|hold|balance|available)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern AT_MERCHANT = Pattern.compile("(?:^|\\b)(?:at|to)\\s+(.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERIC = Pattern.compile("(?i)^(?:google (?:wallet|pay)|wallet|payment|purchase|transaction|notification|you (?:paid|spent)|(?:payment|purchase|transaction) (?:successful|approved|complete|completed)|paid|spent|tap\\b.*|view\\b.*|.*(?:ending (?:in )?|[•*]{2,})\\d{2,4})[.!:]?$");

    public static final class Result {
        public final String status, reason, currency, merchant;
        public final Long cents;
        private Result(String status, String reason, Long cents, String currency, String merchant) {
            this.status = status; this.reason = reason; this.cents = cents; this.currency = currency; this.merchant = merchant;
        }
    }

    private static Result review(String reason) { return new Result("needs_review", reason, null, null, null); }

    private static String normalize(String value) {
        if (value == null) return "";
        return value.replaceAll("[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "")
            .replace('\u00a0', ' ').replace('\u202f', ' ').replaceAll("\\s+", " ").trim();
    }

    private static String currency(String unit) {
        if (unit.equals("€")) return "EUR";
        if (unit.equals("£")) return "GBP";
        if (unit.equals("₽")) return "RUB";
        return unit.toUpperCase(Locale.ROOT);
    }

    /** Accept decimal cents and validated thousands grouping; never guess 1,234. */
    private static Long cents(String amount) {
        if (amount.startsWith("-") || amount.startsWith("+")) return null;
        String integer = amount, fraction = "";
        int dot = amount.lastIndexOf('.'), comma = amount.lastIndexOf(',');
        int separator = Math.max(dot, comma);
        if (separator >= 0) {
            String tail = amount.substring(separator + 1);
            if (tail.length() < 1 || tail.length() > 2 || !tail.matches("[0-9]+")) return null;
            fraction = tail;
            integer = amount.substring(0, separator);
            char decimal = amount.charAt(separator);
            if (integer.indexOf(decimal) >= 0) return null;
        }
        if (!integer.matches("[0-9]+") && !integer.matches("[0-9]{1,3}(?: [0-9]{3})+")
            && !integer.matches("[0-9]{1,3}(?:,[0-9]{3})+") && !integer.matches("[0-9]{1,3}(?:\\.[0-9]{3})+")) return null;
        try {
            long value = new BigDecimal(integer.replaceAll("[ ,.]", "") + (fraction.isEmpty() ? "" : "." + fraction)).movePointRight(2).longValueExact();
            return value > 0 && value <= 99999999999L ? value : null;
        } catch (ArithmeticException | NumberFormatException invalid) { return null; }
    }

    private static String merchant(String candidate) {
        candidate = candidate.replaceFirst("(?i)\\s+(?:using your|with your|with card|on card|card ending)\\b.*$", "")
            .replaceFirst("(?i)\\s+(?:on \\d{4}-\\d{2}-\\d{2}|tap to|view details)\\b.*$", "")
            .replaceAll("^[\\s:•|–—-]+|[\\s:•|–—-]+$", "").trim();
        if (candidate.isEmpty() || candidate.length() > 200 || GENERIC.matcher(candidate).matches()
            || Pattern.compile("(?i)^(?:with|using|on card|card ending|you paid|you spent|paid|spent|payment|purchase|transaction)\\b").matcher(candidate).find()
            || !Pattern.compile("\\p{L}").matcher(candidate).find() || MONEY.matcher(candidate).find()) return null;
        return candidate;
    }

    public static Result parse(String title, String text, String bigText, String subText) {
        Set<String> unique = new LinkedHashSet<>();
        for (String field : new String[]{title, text, bigText, subText}) {
            if (field != null && field.length() > 10000) return review("text_too_long");
            String normalized = normalize(field);
            if (!normalized.isEmpty()) unique.add(normalized);
        }
        // Expanded notification text often repeats the shorter body.
        String expanded = normalize(bigText), body = normalize(text);
        if (!body.isEmpty() && !expanded.equals(body) && expanded.contains(body)) unique.remove(body);
        List<String> fields = new ArrayList<>(unique);
        if (fields.isEmpty()) return review("missing_text");
        String all = String.join("\n", fields);
        if (NON_PURCHASE.matcher(all).find()) return new Result("ignored", "non_purchase_message", null, null, null);
        if (UNCERTAIN.matcher(all).find()) return review("uncertain_transaction");

        String amount = null, code = null;
        int matches = 0;
        for (String field : fields) {
            Matcher matcher = MONEY.matcher(field);
            while (matcher.find()) {
                matches++;
                code = currency(matcher.group(1) != null ? matcher.group(1) : matcher.group(4));
                amount = matcher.group(2) != null ? matcher.group(2) : matcher.group(3);
            }
        }
        if (matches == 0) return review("missing_amount_or_currency");
        if (matches > 1) return review("multiple_amounts");
        if (code.equals("$")) return review("ambiguous_currency");
        if (Currency.getInstance(code).getDefaultFractionDigits() != 2) return review("unsupported_currency_precision");
        Long value = cents(amount);
        if (value == null) return review("invalid_or_ambiguous_amount");

        Set<String> candidates = new LinkedHashSet<>();
        for (String field : fields) {
            String withoutAmount = MONEY.matcher(field).replaceAll("").trim();
            Matcher at = AT_MERCHANT.matcher(withoutAmount);
            if (at.find()) {
                String candidate = merchant(at.group(1));
                if (candidate != null) candidates.add(candidate);
            }
        }
        if (candidates.isEmpty()) {
            // Common split layout: merchant title + amount body (or the reverse).
            for (String field : fields) {
                if (field.equals(normalize(subText))) continue; // Subtext is often card/account information.
                String candidate = merchant(MONEY.matcher(field).replaceAll(""));
                if (candidate != null) candidates.add(candidate);
            }
        }
        if (candidates.size() != 1) return new Result("needs_review", candidates.isEmpty() ? "missing_merchant" : "ambiguous_merchant", value, code, null);
        return new Result("parsed", null, value, code, candidates.iterator().next());
    }

    private PurchaseNotificationParser() { }
}
