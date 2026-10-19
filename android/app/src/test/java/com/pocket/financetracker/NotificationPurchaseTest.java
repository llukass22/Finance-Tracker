package com.pocket.financetracker;

import static org.junit.Assert.*;
import org.junit.Test;

public class NotificationPurchaseTest {
    private PurchaseNotificationParser.Result parsed(String merchant, String amount) {
        return PurchaseNotificationParser.parse(merchant, amount, null, null);
    }

    @Test public void createsExactCategorizedPurchaseWithStableIdentity() {
        PurchaseNotificationParser.Result parsed = parsed("GASTROBARAS +++", "€3.50 with SEB Debit Mastercard");
        NotificationPurchase purchase = NotificationPurchase.from(parsed, "wallet-key", 1792400000000L);
        assertNotNull(purchase);
        assertEquals(350, purchase.cents);
        assertEquals("Eating Out", purchase.category);
        assertEquals("GASTROBARAS +++", purchase.merchant);
        assertEquals(purchase.id, NotificationPurchase.from(parsed, "wallet-key", 1792400000000L).id);
        assertNotEquals(purchase.id, NotificationPurchase.from(parsed, "wallet-key", 1792400000001L).id);
        assertNotEquals(purchase.id, NotificationPurchase.from(parsed, "another-key", 1792400000000L).id);
    }

    @Test public void unknownMerchantCreatesUncategorizedPurchase() {
        assertEquals("Uncategorized", NotificationPurchase.from(parsed("UAB XYZ", "€3.50"), "key", 1792400000000L).category);
    }

    @Test public void incompleteDeclinedAndForeignCurrencyNeverBecomeEuroRecords() {
        assertNull(NotificationPurchase.from(parsed("Shop", "USD 3.50"), "key", 1792400000000L));
        assertNull(NotificationPurchase.from(parsed("Shop", "Declined €3.50"), "key", 1792400000000L));
        assertNull(NotificationPurchase.from(parsed("Shop", "3.50"), "key", 1792400000000L));
        assertNull(NotificationPurchase.from(parsed("Shop", "€3.50"), "", 1792400000000L));
        assertNull(NotificationPurchase.from(parsed("Shop", "€3.50"), "key", 0));
    }
}
