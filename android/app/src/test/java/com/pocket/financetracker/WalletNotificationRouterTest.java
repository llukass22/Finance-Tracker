package com.pocket.financetracker;

import static org.junit.Assert.*;
import org.junit.Test;

public class WalletNotificationRouterTest {
    private PurchaseNotificationParser.Result route(String source, boolean summary) {
        return WalletNotificationRouter.parse(source, summary, "GASTROBARAS +++", "€3.50 with SEB Debit Mastercard", null, null);
    }

    @Test public void liveWalletAndGoogleServicesUseTheParser() {
        for (String source : new String[]{"com.google.android.apps.walletnfcrel", "com.google.android.gms"}) {
            PurchaseNotificationParser.Result parsed = route(source, false);
            assertEquals("parsed", parsed.status);
            assertEquals(Long.valueOf(350), parsed.cents);
            assertEquals("GASTROBARAS +++", parsed.merchant);
        }
    }

    @Test public void payseraVisaCardIsExcludedFromEveryWalletTextField() {
        for (String source : new String[]{"com.google.android.apps.walletnfcrel", "com.google.android.gms"}) {
            for (int field = 0; field < 4; field++) {
                String[] fields = {"Shop", "€3.50 with SEB Debit Mastercard", null, null};
                fields[field] = (fields[field] == null ? "" : fields[field] + " ") + "Paysera Visa Card";
                PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
                    source, false, fields[0], fields[1], fields[2], fields[3]);
                assertEquals(source + " field " + field, "ignored", parsed.status);
                assertEquals("excluded_paysera_card", parsed.reason);
                assertNull(NotificationPurchase.from(parsed, "wallet-key", 1792400000000L));
            }
        }
    }

    @Test public void payseraExclusionHandlesCaseSpacingAndExpandedBody() {
        PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
            "com.google.android.apps.walletnfcrel", false, "Shop", "€3.50",
            "€3.50 with \u2066pAySeRa\u00a0VISA\u202f\nCard\u2069", null);
        assertEquals("ignored", parsed.status);
        assertEquals("excluded_paysera_card", parsed.reason);
        assertNull(NotificationPurchase.from(parsed, "wallet-key", 1792400000000L));
    }

    @Test public void otherCardsAndPayseraMerchantNamesStillImport() {
        for (String[] fields : new String[][]{
                {"Shop", "€3.50 with SEB Debit Mastercard"},
                {"Paysera", "€3.50 with SEB Debit Mastercard"},
                {"Shop", "€3.50 with Visa Card"}}) {
            PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
                "com.google.android.apps.walletnfcrel", false, fields[0], fields[1], null, null);
            assertNotNull(NotificationPurchase.from(parsed, "wallet-key", 1792400000000L));
        }
    }

    @Test public void unrelatedAppsAndGroupSummariesAreNotParsed() {
        assertNull(route("com.google.android.gm", false));
        assertNull(route("com.pocket.financetracker", false));
        assertNull(route(null, false));
        assertNull(route("com.google.android.apps.walletnfcrel", true));
    }

    @Test public void swedbankOutgoingTransfersCreateEuroPurchases() {
        String body = "5 EUR has been sent to LUKAS RUZEVICIUS";
        String source = "lt.swedbank.mobile";
        PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
            source, false, "Notification from Swedbank", body, null, null);
        assertTrue(WalletNotificationRouter.canImport(source, body, null));
        NotificationPurchase purchase = NotificationPurchase.from(parsed, "swedbank-key", 1792400000000L);
        assertNotNull(purchase);
        assertEquals(500, purchase.cents);
        assertEquals("LUKAS RUZEVICIUS", purchase.merchant);
    }

    @Test public void swedbankPaidAtCreatesAnExpenseFromAnyTextField() {
        String payment = "1.99 EUR paid at WL*GOOGLE Dublin IE.";
        for (int field = 0; field < 4; field++) {
            String[] fields = {"Notification from Swedbank", null, null, null};
            fields[field] = "Notification from Swedbank\n" + payment;
            PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
                "lt.swedbank.mobile", false, fields[0], fields[1], fields[2], fields[3]);
            NotificationPurchase purchase = NotificationPurchase.from(parsed, "swedbank-key", 1792400000000L);
            assertNotNull("Notification field " + field, purchase);
            assertEquals(199, purchase.cents);
            assertEquals("WL*GOOGLE Dublin IE", purchase.merchant);
        }
    }

    @Test public void swedbankPaidAtHandlesAnExpandedNotificationWithLeadingText() {
        PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
            "lt.swedbank.mobile", false, "Notification from Swedbank", "Card payment: 1,99 EUR",
            "Card payment: 1,99 EUR PAID AT\nWL*GOOGLE Dublin IE.", null);
        assertEquals("parsed", parsed.status);
        assertEquals(Long.valueOf(199), parsed.cents);
        assertEquals("WL*GOOGLE Dublin IE", parsed.merchant);
    }

    @Test public void swedbankPaidAtReadsExpandedDetailsAndRejectsConflictingPayments() {
        String source = "lt.swedbank.mobile";
        String title = "Notification from Swedbank";
        String payment = "1.99 EUR paid at WL*GOOGLE Dublin IE.";
        PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
            source, false, title, "Card payment", payment, null);
        assertEquals("parsed", parsed.status);
        assertEquals(Long.valueOf(199), parsed.cents);

        PurchaseNotificationParser.Result conflicting = WalletNotificationRouter.parse(
            source, false, title, "2.99 EUR paid at WL*GOOGLE Dublin IE.", payment, null);
        assertEquals("conflicting_notification_text", conflicting.reason);
        assertNull(NotificationPurchase.from(conflicting, "swedbank-key", 1792400000000L));
    }

    @Test public void swedbankPaidAtRequiresACompletedPaymentWithAmountAndMerchant() {
        for (String body : new String[]{
                "Paid at WL*GOOGLE Dublin IE.", "1.99 USD paid at WL*GOOGLE Dublin IE.",
                "-1.99 EUR paid at WL*GOOGLE Dublin IE.", "1.99 EUR paid at .",
                "Payment declined: 1.99 EUR paid at WL*GOOGLE Dublin IE."}) {
            PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
                "lt.swedbank.mobile", false, "Notification from Swedbank", body, null, null);
            assertNull(body, NotificationPurchase.from(parsed, "swedbank-key", 1792400000000L));
        }
    }

    @Test public void swedbankHandlesExpandedTextAndDecimalAmounts() {
        String body = "12,34 EUR has been sent to Example Recipient.";
        PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(
            "lt.swedbank.mobile", false, "Notification from Swedbank",
            "12,34 EUR has been sent", "Notification from Swedbank\n" + body, null);
        assertEquals("parsed", parsed.status);
        assertEquals(Long.valueOf(1234), parsed.cents);
        assertEquals("Example Recipient", parsed.merchant);
    }

    @Test public void swedbankSkipsIncomingAndInvalidNotifications() {
        String source = "lt.swedbank.mobile";
        String title = "Notification from Swedbank";
        String outgoing = "5 EUR has been sent to Example Recipient";
        for (String body : new String[]{
                "5 EUR has been received from Example Recipient", "You received 5 EUR",
                "5 EUR will be sent to Example Recipient", "5 USD has been sent to Example Recipient",
                "0 EUR has been sent to Example Recipient", "5 EUR has been sent to ."}) {
            PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(source, false, title, body, null, null);
            assertNull(body, NotificationPurchase.from(parsed, "swedbank-key", 1792400000000L));
        }
        assertEquals("conflicting_notification_text", WalletNotificationRouter.parse(
            source, false, title, outgoing, "8 EUR has been sent to Example Recipient", null).reason);
        assertNull(WalletNotificationRouter.parse(source, true, title, outgoing, null, null));
        assertNull(WalletNotificationRouter.parse("com.example.app", false, title, outgoing, null, null));
    }

    @Test public void playServicesNeedsPaymentWordingBeforeAutomaticImport() {
        assertTrue(WalletNotificationRouter.canImport("com.google.android.gms", "€3.50 with SEB Debit Mastercard", null));
        assertTrue(WalletNotificationRouter.canImport("com.google.android.gms", "You paid €3.50 at Shop", null));
        assertFalse(WalletNotificationRouter.canImport("com.google.android.gms", "€3.50 subscription offer", null));
        assertFalse(WalletNotificationRouter.canImport("com.google.android.gm", "You paid €3.50 at Shop", null));
    }
}
