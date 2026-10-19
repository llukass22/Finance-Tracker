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
