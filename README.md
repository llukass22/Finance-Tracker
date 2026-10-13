# Pocket — local finance tracker

A mobile-first EUR spending tracker with Car, House, Paysera, Eating Out, Food, Drinks, and Bills. No installation of packages, account, or backend is needed.

## Run

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

The app starts empty. Amounts are stored as integer cents. Data stays in the browser. Fonts use Google Fonts with local sans-serif fallbacks; all core features work without that font request.

## Validation

    npm run check

The static app can also be served by any local HTTP server. The included server binds to all local interfaces on port 3000; set the PORT environment variable to use a different port.

Run the automated functional checks with: `npm test`. These check accounting and interaction logic in a minimal DOM harness; visual browser verification was unavailable in this environment.
