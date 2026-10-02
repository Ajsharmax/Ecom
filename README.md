# Markettech.in E-commerce

A project to build and test a beginner-friendly kitchen and household storefront for the owner's domain, `markettech.in`.

## Run the preview

Requires Python 3.10 or newer; no external Python packages are needed.

```bash
python3 server.py --host 0.0.0.0 --port 4173
```

Open `/` for the storefront and `/admin.html` for the owner panel. On first admin visit, create a password of at least 12 characters; this one-time setup locks after the account is created. The local SQLite database is stored in `data/markettech.sqlite3` and is ignored by Git.

The admin panel can add/edit/archive products, change prices and stock, set low-stock warnings, update storefront announcement/about text and support email, and export product or inventory lists as CSV. Storefront product and stock changes come from the SQLite database.

## Important preview limits

The product names, photos, stock counts, and INR prices are samples. The shopping bag is browser-local. Checkout is deliberately disabled: no customer details are collected, no order is created, and no payment is taken. The Orders page explains this until a real checkout and payment provider are selected.

This standard-library server and first-run admin setup are for development and preview only. Before opening a public store, use production hosting with HTTPS, reviewed authentication and setup, monitored backups, and the chosen payment and shipping providers.

## Tests

```bash
python3 -m unittest discover -v
node --check app.js
node --check admin.js
```

## Project notes

- Beginner-friendly roadmap PDF with an order flowchart: [`docs/Markettech_Beginner_Roadmap.pdf`](docs/Markettech_Beginner_Roadmap.pdf)
- Persistent project context: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)
- Detailed build and launch roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)
