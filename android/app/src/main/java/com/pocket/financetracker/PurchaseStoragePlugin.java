package com.pocket.financetracker;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "PurchaseStorage")
public class PurchaseStoragePlugin extends Plugin {
    private PurchaseDatabase database;

    @Override public void load() { database = new PurchaseDatabase(getContext()); }

    private void resolve(PluginCall call, JSONObject state) throws Exception {
        call.resolve(new JSObject(state.toString()));
    }

    private String source(PluginCall call) {
        String source = call.getString("source", "localStorage.v1");
        if (!source.startsWith("localStorage.v1") || source.length() > 500) throw new IllegalArgumentException("Invalid migration source");
        return source;
    }

    @PluginMethod public void read(PluginCall call) {
        try { resolve(call, database.read(source(call))); }
        catch (Exception error) { call.reject("Could not read purchase database", error); }
    }

    @PluginMethod public void migrate(PluginCall call) {
        try {
            JSONArray purchases = call.getArray("purchases");
            if (purchases == null) throw new IllegalArgumentException("Purchases are required");
            resolve(call, database.migrate(purchases, source(call)));
        } catch (Exception error) { call.reject("Could not migrate purchases", error); }
    }

    @PluginMethod public void applyChanges(PluginCall call) {
        try {
            JSONArray upserts = call.getArray("upserts"), deleted = call.getArray("deletedIds");
            if (upserts == null || deleted == null) throw new IllegalArgumentException("Changes are required");
            resolve(call, database.applyChanges(upserts, deleted));
        } catch (Exception error) { call.reject("Could not save purchases", error); }
    }

    @Override protected void handleOnDestroy() { database.close(); }
}
