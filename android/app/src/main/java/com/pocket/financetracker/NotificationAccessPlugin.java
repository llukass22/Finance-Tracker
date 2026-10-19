package com.pocket.financetracker;

import android.app.NotificationManager;
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

@CapacitorPlugin(name = "NotificationAccess")
public class NotificationAccessPlugin extends Plugin {
    private ComponentName component() {
        return new ComponentName(getContext(), PocketNotificationListener.class);
    }

    private boolean enabled() {
        // The manifest default is disabled. Explicit component state survives app restarts.
        return getContext().getPackageManager().getComponentEnabledSetting(component())
            == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
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
