package com.pocket.financetracker;

import static org.junit.Assert.*;
import org.junit.Test;

public class PurchaseNotificationParserTest {
    private PurchaseNotificationParser.Result parse(String title, String text) {
        return PurchaseNotificationParser.parse(title, text, null, null);
    }

    private void purchase(String title, String text, long cents, String currency, String merchant) {
        PurchaseNotificationParser.Result result = parse(title, text);
        assertEquals(result.reason, "parsed", result.status);
        assertEquals(Long.valueOf(cents), result.cents);
        assertEquals(currency, result.currency);
        assertEquals(merchant, result.merchant);
    }

    @Test public void actualWalletNotificationSeparatesMerchantAndCard() {
        purchase("GASTROBARAS +++", "€3.50 with SEB Debit Mastercard", 350, "EUR", "GASTROBARAS +++");
    }

    @Test public void decimalCommaWalletNotification() {
        purchase("GASTROBARAS +++", "3,50 € with SEB Debit Mastercard", 350, "EUR", "GASTROBARAS +++");
    }

    @Test public void parsesSentenceAndCurrencyCode() {
        purchase("Google Wallet", "You paid EUR 12.50 at Coffee House", 1250, "EUR", "Coffee House");
        purchase(null, "You spent 12,50 EUR at Coffee House", 1250, "EUR", "Coffee House");
    }

    @Test public void parsesWholeAmountsAndOtherExplicitCurrencies() {
        purchase("Shop", "€12 with SEB Debit Mastercard", 1200, "EUR", "Shop");
        purchase("Shop", "GBP 12.50", 1250, "GBP", "Shop");
        purchase("Shop", "12.50 USD", 1250, "USD", "Shop");
        purchase("Shop", "£12.50", 1250, "GBP", "Shop");
    }

    @Test public void recognizesValidatedThousandsSeparators() {
        purchase("Shop", "€1,234.56", 123456, "EUR", "Shop");
        purchase("Shop", "1.234,56 EUR", 123456, "EUR", "Shop");
        purchase("Shop", "1\u202f234,56 €", 123456, "EUR", "Shop");
    }

    @Test public void handlesBidiAndNonbreakingSpaces() {
        purchase("GASTROBARAS +++", "\u2066€\u00a03.50\u2069 with SEB Debit Mastercard", 350, "EUR", "GASTROBARAS +++");
    }

    @Test public void expandedBodyDoesNotDoubleCountRepeatedMoney() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("Shop", "€3.50", "€3.50 with SEB Debit Mastercard", null);
        assertEquals("parsed", result.status);
        assertEquals("Shop", result.merchant);
        result = PurchaseNotificationParser.parse("Shop", "€3.50", "€3.50", null);
        assertEquals("parsed", result.status);
    }

    @Test public void cardSubtextIsNotASecondMerchant() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("Shop", "€3.50", null, "SEB Debit Mastercard");
        assertEquals("Shop", result.merchant);
        assertEquals("parsed", result.status);
    }

    @Test public void rejectsAmbiguousOrInvalidAmounts() {
        for (String amount : new String[]{"€1,234", "€1.234", "€12,34.56", "€12.34,67", "€0.00", "€-3.50", "€+3.50", "€1000000000.00"}) {
            assertEquals(amount, "needs_review", parse("Shop", amount).status);
        }
    }

    @Test public void neverAssumesDollarCurrencyOrMissingCurrency() {
        assertEquals("ambiguous_currency", parse("Shop", "$3.50").reason);
        assertEquals("missing_amount_or_currency", parse("Shop", "3.50 with SEB Debit Mastercard").reason);
        assertEquals("unsupported_currency_precision", parse("Shop", "JPY 350").reason);
    }

    @Test public void refusesMultipleAmountsIncludingBalance() {
        assertEquals("multiple_amounts", parse("Shop", "€3.50 and €4.50").reason);
        assertEquals("needs_review", parse("Shop", "€3.50. Available balance €100.00").status);
    }

    @Test public void ignoresNonPurchaseAlerts() {
        for (String message : new String[]{"Payment declined: €3.50", "Payment failed €3.50", "Refunded €3.50", "€3.50 reversed", "Verification code 123456"}) {
            assertEquals(message, "ignored", parse("Shop", message).status);
        }
        assertEquals("needs_review", parse("Shop", "Pending payment €3.50").status);
    }

    @Test public void missingOrConflictingMerchantsNeedReview() {
        assertEquals("missing_merchant", parse("Google Wallet", "€3.50 with SEB Debit Mastercard").reason);
        assertEquals("missing_merchant", parse(null, "You paid €3.50 at").reason);
        assertEquals("ambiguous_merchant", PurchaseNotificationParser.parse("At Shop One", "€3.50 at Shop Two", null, null).reason);
    }

    @Test public void emptyAndOversizedMessagesAreSafe() {
        assertEquals("missing_text", parse(null, null).reason);
        assertEquals("text_too_long", parse("Shop", new String(new char[10001])).reason);
    }
}
