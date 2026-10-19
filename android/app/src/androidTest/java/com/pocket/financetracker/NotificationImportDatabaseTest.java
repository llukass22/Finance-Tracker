package com.pocket.financetracker;

import static org.junit.Assert.*;
import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NotificationImportDatabaseTest {
    private Context context;
    private PurchaseDatabase database;
    private final String name = "notification-import-test.db";
    private final long time = 1792400000000L;

    @Before public void setup() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.deleteDatabase(name);
        database = new PurchaseDatabase(context, name);
        database.migrate(new JSONArray());
    }
    @After public void cleanup() { database.close(); context.deleteDatabase(name); }

    private NotificationPurchase purchase(String key, long timestamp, String merchant) {
        return NotificationPurchase.from(PurchaseNotificationParser.parse(merchant, "€3.50 with SEB Debit Mastercard", null, null), key, timestamp);
    }

    @Test public void repeatedAlertsDoNotDuplicateOrUndoUserEdits() throws Exception {
        NotificationPurchase purchase = purchase("key", time, "GASTROBARAS +++");
        assertEquals("saved", database.importNotification(purchase));
        JSONObject edited = database.read().getJSONArray("purchases").getJSONObject(0).put("category", "Uncategorized").put("note", "Edited by me");
        database.applyChanges(new JSONArray().put(edited), new JSONArray());
        database.close(); database = new PurchaseDatabase(context, name);
        assertEquals("duplicate", database.importNotification(purchase));
        JSONArray records = database.read().getJSONArray("purchases");
        assertEquals(1, records.length());
        assertEquals("Edited by me", records.getJSONObject(0).getString("note"));
    }

    @Test public void identicalAmountsForSeparatePurchasesRemainSeparate() throws Exception {
        database.importNotification(purchase("key", time, "GASTROBARAS +++"));
        database.importNotification(purchase("key", time + 1000, "GASTROBARAS +++"));
        database.importNotification(purchase("another-key", time + 1000, "GASTROBARAS +++"));
        assertEquals(3, database.read().getJSONArray("purchases").length());
    }

    @Test public void deletedPurchasesAreNotRecreatedByRepeats() throws Exception {
        NotificationPurchase purchase = purchase("key", time, "GASTROBARAS +++");
        database.importNotification(purchase);
        database.applyChanges(new JSONArray(), new JSONArray().put(purchase.id));
        assertEquals("duplicate", database.importNotification(purchase));
        assertEquals(0, database.read().getJSONArray("purchases").length());
    }

    @Test public void failedReceiptWriteRollsBackPurchaseAndAllowsRetry() throws Exception {
        database.getWritableDatabase().execSQL("CREATE TRIGGER reject_receipt BEFORE INSERT ON notification_imports BEGIN SELECT RAISE(ABORT, 'test failure'); END");
        NotificationPurchase purchase = purchase("key", time, "UAB XYZ");
        try { database.importNotification(purchase); fail("Expected database failure"); }
        catch (android.database.sqlite.SQLiteException expected) { }
        assertEquals(0, database.read().getJSONArray("purchases").length());
        database.getWritableDatabase().execSQL("DROP TRIGGER reject_receipt");
        assertEquals("saved", database.importNotification(purchase));
        assertEquals("Uncategorized", database.read().getJSONArray("purchases").getJSONObject(0).getString("category"));
    }

    @Test public void restoredPurchaseIdPreventsReimportWithoutChangingRestoredData() throws Exception {
        NotificationPurchase purchase = purchase("key", time, "GASTROBARAS +++");
        JSONObject restored = new JSONObject().put("id", purchase.id).put("cents", 999).put("category", "Food")
            .put("note", "Restored version").put("date", purchase.date).put("createdAt", time);
        database.applyChanges(new JSONArray().put(restored), new JSONArray());
        assertEquals("duplicate", database.importNotification(purchase));
        assertEquals(999, database.read().getJSONArray("purchases").getJSONObject(0).getLong("cents"));
    }

    @Test public void versionOneUpgradePreservesPurchases() throws Exception {
        database.close(); context.deleteDatabase(name);
        SQLiteOpenHelper old = new SQLiteOpenHelper(context, name, null, 1) {
            @Override public void onCreate(SQLiteDatabase db) {
                db.execSQL("CREATE TABLE purchases (id TEXT PRIMARY KEY NOT NULL, cents INTEGER NOT NULL, category TEXT NOT NULL, note TEXT NOT NULL, date TEXT NOT NULL, createdAt INTEGER NOT NULL)");
                db.execSQL("CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
                db.execSQL("INSERT INTO purchases VALUES ('existing', 100, 'Food', 'Old purchase', '2026-10-19', 1)");
            }
            @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }
        };
        old.getWritableDatabase(); old.close();
        database = new PurchaseDatabase(context, name);
        assertEquals(1, database.read().getJSONArray("purchases").length());
        assertEquals("saved", database.importNotification(purchase("key", time, "UAB XYZ")));
        assertEquals(2, database.read().getJSONArray("purchases").length());
    }
}
