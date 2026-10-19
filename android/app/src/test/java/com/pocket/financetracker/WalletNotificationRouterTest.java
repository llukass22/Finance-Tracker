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

    @Test public void unrelatedAppsAndGroupSummariesAreNotParsed() {
        assertNull(route("com.google.android.gm", false));
        assertNull(route("com.pocket.financetracker", false));
        assertNull(route(null, false));
        assertNull(route("com.google.android.apps.walletnfcrel", true));
    }

    @Test public void playServicesNeedsPaymentWordingBeforeAutomaticImport() {
        assertTrue(WalletNotificationRouter.canImport("com.google.android.gms", "€3.50 with SEB Debit Mastercard", null));
        assertTrue(WalletNotificationRouter.canImport("com.google.android.gms", "You paid €3.50 at Shop", null));
        assertFalse(WalletNotificationRouter.canImport("com.google.android.gms", "€3.50 subscription offer", null));
        assertFalse(WalletNotificationRouter.canImport("com.google.android.gm", "You paid €3.50 at Shop", null));
    }
}
