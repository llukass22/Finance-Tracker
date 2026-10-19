package com.pocket.financetracker;

import android.app.NotificationManager;
import android.Manifest;
import android.net.Uri;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import org.json.JSONObject;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "NotificationAccess", permissions = {
    @Permission(alias = "purchaseNotifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class NotificationAccessPlugin extends Plugin {
    private static volatile WeakReference<NotificationAccessPlugin> active = new WeakReference<>(null);
    private static volatile JSObject lastResult;

    @Override public void load() {
        active = new WeakReference<>(this);
        PurchaseNotifier.createChannel(getContext());
    }

    private JSObject purchaseNotificationStatus() {
        JSObject status = new JSObject();
        status.put("permissionGranted", PurchaseNotifier.permissionGranted(getContext()));
        status.put("enabled", PurchaseNotifier.enabled(getContext()));
        return status;
    }

    @PluginMethod public void getPurchaseNotificationStatus(PluginCall call) {
        call.resolve(purchaseNotificationStatus());
    }

    @PluginMethod public void requestPurchaseNotifications(PluginCall call) {
        if (getActivity() == null) { call.reject("Notification permission requires an active app screen"); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("purchaseNotifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("purchaseNotifications", call, "purchaseNotificationPermissionResult");
        } else {
            call.resolve(purchaseNotificationStatus());
        }
    }

    @PermissionCallback private void purchaseNotificationPermissionResult(PluginCall call) {
        call.resolve(purchaseNotificationStatus());
    }

    @PluginMethod public void openPurchaseNotificationSettings(PluginCall call) {
        if (getActivity() == null) { call.reject("Notification settings require an active app screen"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
                    : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception error) { call.reject("Could not open purchase notification settings", error); }
        });
    }

    @Override protected void handleOnDestroy() {
        if (active.get() == this) active.clear();
    }

    private static JSObject resultObject(PurchaseNotificationParser.Result parsed) {
        JSObject result = new JSObject();
        result.put("status", parsed.status);
        result.put("reason", parsed.reason == null ? JSONObject.NULL : parsed.reason);
        result.put("cents", parsed.cents == null ? JSONObject.NULL : parsed.cents);
        result.put("currency", parsed.currency == null ? JSONObject.NULL : parsed.currency);
        result.put("merchant", parsed.merchant == null ? JSONObject.NULL : parsed.merchant);
        return result;
    }

    static void parsed(PurchaseNotificationParser.Result parsed, String outcome, NotificationPurchase purchase) {
        JSObject result = resultObject(parsed);
        result.put("parsedAt", System.currentTimeMillis());
        result.put("importStatus", outcome);
        result.put("category", purchase == null ? JSONObject.NULL : purchase.category);
        result.put("purchaseId", purchase == null ? JSONObject.NULL : purchase.id);
        lastResult = result; // One transient preview; never persisted or logged.
        NotificationAccessPlugin plugin = active.get();
        if (plugin != null) {
            plugin.notifyListeners("notificationParsed", result);
            if ("saved".equals(outcome)) plugin.notifyListeners("purchasesChanged", new JSObject());
        }
    }

    static void connectionChanged() {
        NotificationAccessPlugin plugin = active.get();
        if (plugin != null) plugin.notifyListeners("listenerStatusChanged", new JSObject());
    }

    @PluginMethod public void getLastResult(PluginCall call) {
        JSObject result = new JSObject();
        JSObject snapshot = lastResult;
        result.put("result", snapshot == null ? JSONObject.NULL : snapshot);
        call.resolve(result);
    }

    /** Parse supplied text only. This does not read notifications or save purchases. */
    @PluginMethod public void parseNotification(PluginCall call) {
        for (String key : new String[]{"title", "text", "bigText", "subText"}) {
            Object value = call.getData().opt(key);
            if (value != null && value != JSONObject.NULL && !(value instanceof String)) {
                call.reject(key + " must be a string");
                return;
            }
        }
        PurchaseNotificationParser.Result parsed = PurchaseNotificationParser.parse(
            call.getString("title"), call.getString("text"), call.getString("bigText"), call.getString("subText"));
        call.resolve(resultObject(parsed));
    }

    private ComponentName component() {
        return new ComponentName(getContext(), PocketNotificationListener.class);
    }

    private boolean enabled() {
        // The manifest default is enabled. Explicit disablement survives app restarts.
        int state = getContext().getPackageManager().getComponentEnabledSetting(component());
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT;
    }

    private boolean accessGranted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            return getContext().getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component());
        }
        // Android 7.0–8.0 lack the component-specific NotificationManager API.
        String listeners = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        if (listeners != null) {
            for (String listener : listeners.split(":")) {
                if (component().equals(ComponentName.unflattenFromString(listener))) return true;
            }
        }
        return false;
    }

    private JSObject status() {
        boolean enabled = enabled(), granted = accessGranted();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("accessGranted", granted);
        result.put("connected", enabled && granted && PocketNotificationListener.isConnected());
        return result;
    }

    @PluginMethod public void getStatus(PluginCall call) {
        try { call.resolve(status()); }
        catch (Exception error) { call.reject("Could not check notification access", error); }
    }

    @PluginMethod public void setEnabled(PluginCall call) {
        Object requested = call.getData().opt("enabled");
        if (!(requested instanceof Boolean)) {
            call.reject("enabled must be a boolean");
            return;
        }
        try {
            boolean enabled = (Boolean) requested;
            getContext().getPackageManager().setComponentEnabledSetting(component(), enabled
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            if (enabled && accessGranted()) NotificationListenerService.requestRebind(component());
            if (!enabled) lastResult = null;
            call.resolve(status());
        } catch (Exception error) { call.reject("Could not change notification listener state", error); }
    }

    @PluginMethod public void openSettings(PluginCall call) {
        if (getActivity() == null) { call.reject("Notification settings require an active app screen"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                if (!enabled()) {
                    call.reject("Enable the listener before opening notification access settings");
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                            .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component().flattenToString()));
                        call.resolve();
                        return;
                    } catch (ActivityNotFoundException unavailable) {
                        // Some devices only provide the general notification access list.
                    }
                }
                getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                call.resolve();
            } catch (Exception error) { call.reject("Could not open notification access settings", error); }
        });
    }
}
