package com.pocket.financetracker;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.text.ParsePosition;
import java.util.Locale;
import java.util.Date;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** App-private source of purchase records, independent of the WebView lifecycle. */
public final class PurchaseDatabase extends SQLiteOpenHelper {
    private static final Set<String> CATEGORIES = new HashSet<>(Arrays.asList(
        "Car", "House", "Paysera", "Eating Out", "Food", "Drinks", "Bills", "Uncategorized"));

    public PurchaseDatabase(Context context) { this(context, "pocket-purchases.db"); }
    PurchaseDatabase(Context context, String name) { super(context, name, null, 1); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE purchases (id TEXT PRIMARY KEY NOT NULL, cents INTEGER NOT NULL CHECK(cents > 0 AND cents <= 99999999999), category TEXT NOT NULL, note TEXT NOT NULL, date TEXT NOT NULL, createdAt INTEGER NOT NULL CHECK(createdAt >= 0))");
        db.execSQL("CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("Unsupported purchase database version");
    }

    private boolean migrated(SQLiteDatabase db, String source) {
        try (Cursor cursor = db.rawQuery("SELECT value FROM metadata WHERE key = ?", new String[]{source})) {
            return cursor.moveToFirst();
        }
    }

    private JSONObject state(SQLiteDatabase db, String source) throws JSONException {
        JSONArray purchases = new JSONArray();
        try (Cursor cursor = db.query("purchases", new String[]{"id", "cents", "category", "note", "date", "createdAt"}, null, null, null, null, "createdAt, id")) {
            while (cursor.moveToNext()) {
                purchases.put(new JSONObject().put("id", cursor.getString(0)).put("cents", cursor.getLong(1))
                    .put("category", cursor.getString(2)).put("note", cursor.getString(3))
                    .put("date", cursor.getString(4)).put("createdAt", cursor.getLong(5)));
            }
        }
        return new JSONObject().put("purchases", purchases).put("migrated", migrated(db, source));
    }

    public JSONObject read() throws JSONException { return read("localStorage.v1"); }
    public synchronized JSONObject read(String source) throws JSONException { return state(getReadableDatabase(), source); }

    private static String text(JSONObject record, String key, int max, boolean empty) throws JSONException {
        Object value = record.get(key);
        if (!(value instanceof String) || ((String) value).length() > max || (!empty && ((String) value).isEmpty())) {
            throw new IllegalArgumentException("Invalid purchase " + key);
        }
        return (String) value;
    }

    private static long integer(JSONObject record, String key, long min, long max) throws JSONException {
        Object value = record.get(key);
        if (!(value instanceof Number)) throw new IllegalArgumentException("Invalid purchase " + key);
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number != Math.floor(number) || number < min || number > max) {
            throw new IllegalArgumentException("Invalid purchase " + key);
        }
        return ((Number) value).longValue();
    }

    private static ContentValues values(JSONObject record) throws JSONException {
        ContentValues values = new ContentValues();
        values.put("id", text(record, "id", 100, false));
        values.put("cents", integer(record, "cents", 1, 99999999999L));
        String category = text(record, "category", 100, false);
        if (!CATEGORIES.contains(category)) throw new IllegalArgumentException("Invalid purchase category");
        values.put("category", category);
        values.put("note", text(record, "note", 200, true));
        String date = text(record, "date", 10, false);
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        format.setLenient(false);
        Date parsed = format.parse(date, new ParsePosition(0));
        if (!date.matches("\\d{4}-\\d{2}-\\d{2}") || parsed == null || !format.format(parsed).equals(date)) {
            throw new IllegalArgumentException("Invalid purchase date");
        }
        values.put("date", date);
        values.put("createdAt", integer(record, "createdAt", 0, 9007199254740991L));
        return values;
    }

    private static ContentValues[] validated(JSONArray purchases) throws JSONException {
        ContentValues[] result = new ContentValues[purchases.length()];
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < purchases.length(); i++) {
            result[i] = values(purchases.getJSONObject(i));
            if (!ids.add(result[i].getAsString("id"))) throw new IllegalArgumentException("Duplicate purchase ID");
        }
        return result;
    }

    /** Import and mark completion in one transaction. Existing native IDs win. */
    public JSONObject migrate(JSONArray purchases) throws JSONException { return migrate(purchases, "localStorage.v1"); }
    public synchronized JSONObject migrate(JSONArray purchases, String source) throws JSONException {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            if (!migrated(db, source)) {
                for (ContentValues record : validated(purchases)) {
                    db.insertWithOnConflict("purchases", null, record, SQLiteDatabase.CONFLICT_IGNORE);
                }
                ContentValues marker = new ContentValues();
                marker.put("key", source); marker.put("value", "done");
                db.insertOrThrow("metadata", null, marker);
                marker.put("key", "database.initialized");
                db.insertWithOnConflict("metadata", null, marker, SQLiteDatabase.CONFLICT_IGNORE);
            }
            JSONObject result = state(db, source);
            db.setTransactionSuccessful();
            return result;
        } finally { db.endTransaction(); }
    }

    /** Change only specified IDs so unrelated native writers are never erased. */
    public synchronized JSONObject applyChanges(JSONArray upserts, JSONArray deletedIds) throws JSONException {
        ContentValues[] records = validated(upserts);
        String[] deleted = new String[deletedIds.length()];
        for (int i = 0; i < deleted.length; i++) {
            Object id = deletedIds.get(i);
            if (!(id instanceof String) || ((String) id).isEmpty() || ((String) id).length() > 100) {
                throw new IllegalArgumentException("Invalid deleted purchase ID");
            }
            deleted[i] = (String) id;
        }
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            if (!migrated(db, "database.initialized")) throw new IllegalStateException("Purchase storage is not initialized");
            for (String id : deleted) db.delete("purchases", "id = ?", new String[]{id});
            for (ContentValues record : records) {
                if (db.update("purchases", record, "id = ?", new String[]{record.getAsString("id")}) == 0) {
                    db.insertOrThrow("purchases", null, record);
                }
            }
            JSONObject result = state(db, "database.initialized");
            db.setTransactionSuccessful();
            return result;
        } finally { db.endTransaction(); }
    }
}
