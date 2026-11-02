package com.pocket.financetracker;

import static org.junit.Assert.*;
import org.junit.Test;

public class SebNotificationParserTest {
    private static final String SOURCE = "se.seb.lithuania";
    private static final String PAYMENT = "Pervedėte 18.30 EUR Lietuvos paštas AB.";
    private static final String BODY = PAYMENT + "\nPaskirtis: PSD2 - RS0194354629";

    private PurchaseNotificationParser.Result parse(String body) {
        return WalletNotificationRouter.parse(SOURCE, false, "Nauja operacija", body, null, null);
    }

    private void payment(PurchaseNotificationParser.Result result, long cents, String recipient) {
        assertEquals(result.reason, "parsed", result.status);
        assertEquals(Long.valueOf(cents), result.cents);
        assertEquals("EUR", result.currency);
        assertEquals(recipient, result.merchant);
    }

    @Test public void providedNotificationCreatesAnOutgoingPurchase() {
        PurchaseNotificationParser.Result parsed = parse(BODY);
        payment(parsed, 1830, "Lietuvos paštas AB");
        assertTrue(WalletNotificationRouter.canImport(SOURCE, BODY, null));
        NotificationPurchase purchase = NotificationPurchase.from(parsed, "seb-key", 1792400000000L);
        assertNotNull(purchase);
        assertEquals(1830, purchase.cents);
        assertEquals("Lietuvos paštas AB", purchase.merchant);
        assertEquals("Uncategorized", purchase.category);
    }

    @Test public void handlesDecimalCommaGroupingAndUnicodeSpaces() {
        payment(parse("Pervedėte\u00a01\u202f234,56 EUR Lietuvos paštas AB.\r\nPaskirtis: Siunta"), 123456, "Lietuvos paštas AB");
        payment(parse("\u2066Pervedėte 18,30 EUR Lietuvos paštas AB.\u2069"), 1830, "Lietuvos paštas AB");
        payment(parse("Pervedėte 18 EUR Lietuvos paštas AB"), 1800, "Lietuvos paštas AB");
    }

    @Test public void expandedTextAndRepeatedBodyDoNotDuplicateAmounts() {
        payment(WalletNotificationRouter.parse(SOURCE, false, "Nauja operacija", PAYMENT, BODY, "SEB Lietuva"), 1830, "Lietuvos paštas AB");
        payment(WalletNotificationRouter.parse(SOURCE, false, "Nauja operacija", BODY, BODY, null), 1830, "Lietuvos paštas AB");
        payment(WalletNotificationRouter.parse(SOURCE, false, "Nauja operacija", null, BODY, null), 1830, "Lietuvos paštas AB");
    }

    @Test public void completeNotificationCanBeSuppliedAsOneTextField() {
        payment(WalletNotificationRouter.parse(SOURCE, false, null, "Nauja operacija\n" + BODY, null, null), 1830, "Lietuvos paštas AB");
    }

    @Test public void referenceNeverBecomesTheRecipientOrAnExtraPayment() {
        payment(parse(PAYMENT + "\nPaskirtis: Invoice 25.00 EUR - PSD2"), 1830, "Lietuvos paštas AB");
        payment(parse(PAYMENT + " Paskirtis: Refund verification pending"), 1830, "Lietuvos paštas AB");
        payment(parse("Pervedėte 18.30 EUR UAB A.B. paslaugos.\nPaskirtis: Siunta"), 1830, "UAB A.B. paslaugos");
    }

    @Test public void incomingRequestsAndUnrelatedAlertsNeverCreatePurchases() {
        for (String body : new String[]{
                "Gavote 18.30 EUR Lietuvos paštas AB.",
                "Prašymas pervesti 18.30 EUR Lietuvos paštas AB.",
                "Patvirtinkite: " + PAYMENT,
                "Mokėjimas atmestas. " + PAYMENT,
                "Your code is 123456",
                "You paid EUR 18.30 at Shop"}) {
            PurchaseNotificationParser.Result parsed = parse(body);
            assertEquals(body, "ignored", parsed.status);
            assertNull(NotificationPurchase.from(parsed, "seb-key", 1792400000000L));
        }
    }

    @Test public void outgoingWordingRequiresTheNewOperationHeading() {
        for (String title : new String[]{null, "SEB Lietuva", "Gautas mokėjimas"}) {
            PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(SOURCE, false, title, BODY, null, null);
            assertEquals("unrecognized_seb_notification", parsed.reason);
            assertNull(NotificationPurchase.from(parsed, "seb-key", 1792400000000L));
        }
    }

    @Test public void incompleteInvalidAndConflictingPaymentsNeedReview() {
        for (String body : new String[]{
                "Pervedėte 18.30 EUR .", "Pervedėte 18.30 EUR", "Pervedėte 18.30 Lietuvos paštas AB.",
                "Pervedėte -18.30 EUR Shop.", "Pervedėte 0.00 EUR Shop.", "Pervedėte 1,234 EUR Shop.",
                "Pervedėte 1000000000.00 EUR Shop.", "Pervedėte 18.30 EUR Shop ir 20.00 EUR Other."}) {
            assertEquals(body, "needs_review", parse(body).status);
        }
        PurchaseNotificationParser.Result parsed = WalletNotificationRouter.parse(SOURCE, false,
            "Nauja operacija", PAYMENT, "Pervedėte 20.00 EUR Another shop.", null);
        assertEquals("conflicting_notification_text", parsed.reason);
        assertNull(NotificationPurchase.from(parsed, "seb-key", 1792400000000L));
        assertEquals("missing_text", parse(null).reason);
        assertEquals("text_too_long", parse(new String(new char[10001])).reason);
    }

    @Test public void foreignCurrenciesAreNotSavedAsEuroPayments() {
        PurchaseNotificationParser.Result parsed = parse("Pervedėte 18.30 USD Lietuvos paštas AB.");
        assertEquals("parsed", parsed.status);
        assertEquals("USD", parsed.currency);
        assertNull(NotificationPurchase.from(parsed, "seb-key", 1792400000000L));
        assertEquals("unsupported_currency_precision", parse("Pervedėte 18 JPY Shop.").reason);
    }

    @Test public void summariesAndOtherSebApplicationsAreNotAccepted() {
        assertNull(WalletNotificationRouter.parse(SOURCE, true, "Nauja operacija", BODY, null, null));
        assertNull(WalletNotificationRouter.parse("se.seb.latvia", false, "Nauja operacija", BODY, null, null));
        assertNull(WalletNotificationRouter.parse(SOURCE + ".other", false, "Nauja operacija", BODY, null, null));
    }
}
