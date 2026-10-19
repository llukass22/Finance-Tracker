# Pocket — local finance tracker

A mobile-first EUR spending tracker with Car, House, Paysera, Eating Out, Food, Drinks, and Bills. Runs as a web app or a standalone Android APK. No account or backend is needed.

## Android APK

The Android app bundles the interface on the phone, so your computer and its web server do not need to stay running. Purchases are saved in an app-private native SQLite database through a local Capacitor plugin. Theme preferences remain in WebView localStorage. The package ID is `com.pocket.financetracker`; keep it the same when building updates.

On the first launch after this storage update, existing Android localStorage purchases are migrated into SQLite in a single transaction. Existing database IDs take precedence. The original localStorage copy is retained for recovery but is never imported again for that origin after a successful migration, so deleted purchases stay deleted. Migration failure leaves the source intact and disables saving instead of silently falling back to older data; reopening the app retries migration. Database reads and writes must finish before the interface reports success. Add, edit, delete, undo, CSV export, and JSON backup/restore all use the native records on Android. This change adds storage only; it does not read notifications or import payments automatically.

Install Node.js 22 or newer and Android Studio with Android SDK platform 36. Use JDK 21 (the generated Gradle wrapper does not support Java 25). In PowerShell, from this project folder:

```powershell
npm ci
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm run android:apk
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. Transfer it to your phone, open it, and allow installation from that source if Android asks. Android 7.0 or newer is required. The first build downloads Gradle and Android dependencies and needs an internet connection.

The build command also detects a compatible JDK in `.tools/` or Android Studio's bundled runtime. On this computer, if `.tools/` contains the downloaded JDK 21, you can simply run `npm run android:apk`. The `.tools/` directory is machine-local and is not committed.

To edit the native project, run `npm run android:open`. After changing the web app, run `npm run android:sync` before building in Android Studio, or use `npm run android:apk`, which syncs automatically.

CSV exports and JSON backups use Android's share sheet. Choose an app that can save or transfer the file. Restore uses the system file picker. The Android back button closes an open dialog, returns from History to Overview, or minimizes the app.

The APK starts with its own empty storage. To move existing browser purchases, download a JSON backup in the browser, then restore it inside the Android app. Uninstalling the app or clearing its storage removes its records. Export backups regularly. Install future APKs as updates using the same package ID and signing key; the debug build uses this computer's Android debug key. For long-term use, keep that key or use a dedicated release signing key.

## Android notification listener foundation

The APK includes a `PocketNotificationListener` service and a local `NotificationAccess` Capacitor plugin. The service component is enabled by default, but Android requires the user to grant notification access before it can connect. Pocket's Android-only Wallet notifications panel shows connection status, opens Android's notification-access settings, and allows the listener to be turned off. It parses new notifications from Google Wallet (`com.google.android.apps.walletnfcrel`) and Google Play services (`com.google.android.gms`, which can post Google payment alerts), skipping group summaries and all other source apps. Google Play services also posts non-payment alerts; parser results from it can therefore be ignored or need review. No notification history is replayed when connecting.

The most recent result is held in process memory for a preview, available through `getLastResult()` as `{ result }`, and emitted as `notificationParsed` while the interface is available. Each live result includes `parsedAt`, `importStatus`, `category`, and `purchaseId`. `listenerStatusChanged` prompts the interface to recheck access and connection state. The preview is cleared when the listener is turned off and disappears when the Android process ends. Raw notification text is not logged or retained. Background notifications are processed while the interface is closed, subject to Android keeping the authorized service connected.

Completed, unambiguous EUR purchase notifications now create purchases directly in SQLite on a background worker. The merchant becomes the purchase note; the notification's `when` timestamp supplies the local date and creation time, falling back to the notification post time if `when` is absent. Foreign currencies, incomplete amounts/merchants, pending transactions, declines, and refunds are not automatically recorded. Google Play services alerts additionally require payment/card wording before import because that app posts other kinds of notifications.

`MerchantCategory` applies conservative local merchant-name rules across the existing categories. Examples: `GASTROBARAS +++` and cafes/restaurants → Eating Out; known grocery stores such as Lidl, Maxima, and Rimi → Food; explicit fuel/car-service names → Car; IKEA/home-supply names → House; wine/liquor shops → Drinks; recognized utilities → Bills; Paysera → Paysera. Unknown names and matches spanning multiple categories become Uncategorized. These are merchant-level rules, not item-level knowledge; categories can still be edited normally.

SQLite schema version 2 adds a notification-import receipt table without changing existing purchases. The receipt and purchase are committed atomically. A hash of Android's notification key plus its event timestamp produces a stable purchase ID, protecting against repeated delivery after process restarts, preserving manual edits, and keeping deleted records deleted. Separate notification keys or event times remain separate, even if the merchant and amount match. Notifications that change both identity/time, or separate alerts from different source apps, cannot reliably be recognized as the same bank transaction from text alone; no fuzzy amount/time matching is used. JSON backups preserve stable automatic purchase IDs, so restoring an existing automatic record also prevents that exact alert from duplicating it. Deleted-record receipt history is local and is not included in purchase-only JSON backups. Failed writes do not commit a receipt, allowing a repeated alert to retry; the latest preview reports save failures.

The `purchasesChanged` event refreshes the open interface after a successful import. Purchases also reload when Pocket resumes. Native saves apply per-record changes rather than replacing the whole database, and refresh responses cannot overwrite newer manual saves. No persistent diagnostic logging is added.

### Purchase confirmation notifications

After an automatic purchase is successfully committed, Pocket can show a local “Purchase recorded” notification with the merchant, EUR amount, and category. Tapping it opens Pocket. Each purchase has its own notification tag, and duplicates, failed saves, skipped alerts, and manual purchases do not produce confirmations. Confirmation delivery runs independently of the interface and does not require a server. If notifications are blocked or delivery fails, the purchase stays saved.

Use **Enable purchase notifications** in the Wallet notifications panel. Android 13 and later show the separate `POST_NOTIFICATIONS` permission prompt; notification-reading access does not grant permission to send alerts. The **Notification settings** link opens Android's outgoing-notification controls so app notifications or the **Automatic purchases** channel can be enabled or disabled. The panel checks both the runtime permission and the app/channel settings and refreshes after returning from Android Settings. Notification sound is controlled by Android and Do Not Disturb. Purchase details use private lock-screen visibility.

The `NotificationAccess` bridge exposes `getPurchaseNotificationStatus()` → `{ permissionGranted, enabled }`, `requestPurchaseNotifications()` → the same status after the system prompt, and `openPurchaseNotificationSettings()`. Only the user's foreground action requests permission; background saves never open a permission prompt. Notifications are not replayed for purchases saved before sending permission was granted.

Android JavaScript can use the bridge as follows:

```javascript
const access = window.pocketNative.notificationAccess;
const status = await access.getStatus(); // { enabled, accessGranted, connected }
await access.setEnabled({ enabled: true });
await access.openSettings(); // The user grants access in Android Settings.
// Check again after returning to Pocket; opening settings does not grant access.
const updatedStatus = await access.getStatus();
await access.setEnabled({ enabled: false });
```

Enable the component before opening settings if it was previously turned off, so Android can list it. Component enablement persists across restarts and is separate from Android's notification-access grant. Disabling removes the component from service discovery; Android may require notification access to be granted again after re-enabling it. `connected` reflects the service's asynchronous connection callbacks, so it may remain false briefly after permission is granted. The bridge is `null` on other native platforms and is absent in the browser. Android 11 and later use the listener-specific settings screen where available, with a fallback to the general notification-access list. Notification access is never granted programmatically.

### Notification text parsing

`PurchaseNotificationParser` is a pure Java parser. `NotificationAccess.parseNotification` accepts optional string fields `title`, `text`, `bigText`, and `subText` without reading device notifications or requiring notification access:

```javascript
await window.pocketNative.notificationAccess.parseNotification({
  title: 'GASTROBARAS +++',
  text: '€3.50 with SEB Debit Mastercard',
});
// { status: 'parsed', reason: null, cents: 350,
//   currency: 'EUR', merchant: 'GASTROBARAS +++' }
```

The parser supports the supplied Wallet merchant-title/card-body format, split merchant/amount fields, and English “paid/spent … at …” messages. Amounts use exact integer cents, decimal dots or commas, and validated thousands separators. It removes bidirectional formatting characters and normalizes nonbreaking spaces. It does not infer currency from the card, language, or phone settings. Bare dollar signs, ambiguous separators, multiple amounts, pending transactions, and missing details return `needs_review` with a reason; recognized decline, refund, reversal, and verification messages return `ignored`. Only supported explicit currencies with two decimal minor units can produce `parsed`; non-EUR results are identified but never converted or saved. These statuses describe text interpretation, not verified bank transactions. Calling `parseNotification` manually only previews text and never creates a purchase; automatic creation runs exclusively through the live listener.

Run parser tests with `./gradlew.bat :app:testDebugUnitTest --tests com.pocket.financetracker.PurchaseNotificationParserTest` from the `android` directory, with the same Java/SDK setup as APK builds.

## Run

### Live reload on your Pixel over USB

Enable USB debugging, connect and unlock your Pixel, and accept the debugging prompt. Then run:

```powershell
npm run android:live
```

This builds and installs a development APK once, starts a local server, and forwards it through USB. Keep the phone connected and this terminal running. Saving `index.html`, `styles.css`, `app.js`, `native.js`, or `favicon.svg` rebuilds the web assets and automatically refreshes Pocket on your phone. No Wi-Fi configuration is needed. Android Studio can stay open but you do not need to click Run after web edits. Native Android or plugin changes require restarting the command.

Press Ctrl+C to stop. The installed live-reload build needs the computer's server; to return to a standalone app, run `npm run android:apk` and install that APK. Live reload and the standalone APK share the Android purchase database. Legacy purchases from each WebView origin migrate once when that origin is first opened. Theme preferences remain specific to the origin. The main Capacitor config stays unchanged; the development URL is only inserted into the generated assets for the development build and restored afterward.

If more than one physical phone is connected, set `$env:ANDROID_SERIAL` to the desired device ID before starting. Reconnect the USB cable and rerun the command if forwarding is lost.

### Browser preview

Install Node.js if needed, then run in this folder:

    npm start

Open http://localhost:3000 on this computer. Keep the terminal running.

## Use on your phone

Connect the phone and computer to the same Wi-Fi. Find your computer's IPv4 address using `ipconfig`, then open `http://YOUR-IP:3000` on the phone (for example, `http://192.168.1.25:3000`). If Windows asks about firewall access, allow Node.js on your private network. This server is intended for your trusted local network.

Each browser saves its own purchases using localStorage. The computer and phone do **not** share records. Keep using the same phone browser and address. Clearing browser data, using private browsing, or changing the address/port can make saved records unavailable. Use the backup button at the top to download a JSON backup; restore it on another device to transfer records. Restoring merges new purchase IDs, retaining existing versions of duplicate IDs.

## Features

- Add and edit purchases with EUR amount, category, optional note, and date.
- Seven category totals and a spending doughnut chart.
- Day, Monday–Sunday week, month, year, and all-time filters.
- Search purchase history and filter by category.
- Delete purchases with a 10-second undo action.
- Export the visible history as CSV; download and restore full JSON backups.
- Responsive layout, accessible labels, keyboard navigation, and no external JavaScript dependencies.

The app starts empty. Amounts are stored as integer cents. Purchases stay on the device: SQLite in the Android APK, localStorage in the browser. Fonts use Google Fonts with local sans-serif fallbacks; all core features work without that font request.

## Validation

    npm run check

The static app can also be served by any local HTTP server. The included server binds to all local interfaces on port 3000; set the PORT environment variable to use a different port.

Run the automated functional checks with: `npm test`. These check accounting and interaction logic in a minimal DOM harness; visual browser verification was unavailable in this environment.
