package com.pocket.financetracker;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PurchaseDatabaseTest {
    private Context context;
    private PurchaseDatabase database;
    private final String name = "purchase-storage-test.db";

    @Before public void setup() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.deleteDatabase(name);
        database = new PurchaseDatabase(context, name);
    }
    @After public void cleanup() { database.close(); context.deleteDatabase(name); }

    private JSONObject record(String id, long cents) throws Exception {
        return new JSONObject().put("id", id).put("cents", cents).put("category", "Food")
            .put("note", "Lunch").put("date", "2026-10-19").put("createdAt", 1);
    }

    @Test public void migrationCrudAndReopen() throws Exception {
        assertFalse(database.read().getBoolean("migrated"));
        database.migrate(new JSONArray().put(record("old", 1250)));
        database.applyChanges(new JSONArray().put(record("old", 1500)).put(record("new", 200)), new JSONArray());
        database.close(); database = new PurchaseDatabase(context, name);
        assertEquals(2, database.read().getJSONArray("purchases").length());
        database.applyChanges(new JSONArray(), new JSONArray().put("old"));
        JSONObject state = database.migrate(new JSONArray().put(record("old", 1250)));
        assertTrue(state.getBoolean("migrated"));
        assertEquals("new", state.getJSONArray("purchases").getJSONObject(0).getString("id"));
    }

    @Test public void invalidBatchCannotDeleteOrPartiallySave() throws Exception {
        database.migrate(new JSONArray().put(record("old", 1250)));
        try {
            database.applyChanges(new JSONArray().put(record("good", 100)).put(record("bad", -1)), new JSONArray().put("old"));
            fail("Invalid purchase accepted");
        } catch (IllegalArgumentException expected) { }
        assertEquals("old", database.read().getJSONArray("purchases").getJSONObject(0).getString("id"));
    }

    @Test public void invalidMigrationIsRetryable() throws Exception {
        try {
            database.migrate(new JSONArray().put(record("good", 100)).put(record("bad", 100).put("date", "2026-02-30")));
            fail("Invalid date accepted");
        } catch (IllegalArgumentException expected) { }
        assertFalse(database.read().getBoolean("migrated"));
        assertEquals(0, database.read().getJSONArray("purchases").length());
        assertEquals(1, database.migrate(new JSONArray().put(record("good", 100))).getJSONArray("purchases").length());
    }

    @Test public void originsMigrateIndependentlyAndNativeRecordsWin() throws Exception {
        database.migrate(new JSONArray().put(record("same", 100)), "localStorage.v1:dev");
        assertFalse(database.read("localStorage.v1:standalone").getBoolean("migrated"));
        JSONArray records = database.migrate(new JSONArray().put(record("same", 999)).put(record("other", 200)), "localStorage.v1:standalone").getJSONArray("purchases");
        assertEquals(2, records.length());
        for (int i = 0; i < records.length(); i++) {
            if (records.getJSONObject(i).getString("id").equals("same")) assertEquals(100, records.getJSONObject(i).getLong("cents"));
        }
    }

    @Test public void sqliteFailureRollsBackEntireWrite() throws Exception {
        database.migrate(new JSONArray().put(record("old", 1250)));
        database.getWritableDatabase().execSQL("CREATE TRIGGER reject_bad BEFORE INSERT ON purchases WHEN NEW.id = 'bad' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
        try {
            database.applyChanges(new JSONArray().put(record("good", 100)).put(record("bad", 100)), new JSONArray().put("old"));
            fail("Expected database failure");
        } catch (android.database.sqlite.SQLiteException expected) { }
        JSONArray records = database.read().getJSONArray("purchases");
        assertEquals(1, records.length());
        assertEquals("old", records.getJSONObject(0).getString("id"));
    }
}
