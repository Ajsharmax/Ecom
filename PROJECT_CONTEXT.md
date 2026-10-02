# Markettech.in — Project Context

Use this file as the durable project memory for future work in this repository.

- **Working brand:** Markettech (name styling is provisional)
- **Domain:** `markettech.in` — the owner says this is their domain. DNS/registrar access and setup have not been verified.
- **Business:** An e-commerce store for the owner's kitchen and household items.
- **Current repository state:** The responsive storefront (`index.html`, `styles.css`, `app.js`) now reads its catalogue from a standard-library Python API backed by local SQLite (`server.py`). An owner area (`admin.html`, `admin.css`, `admin.js`) supports one-time password setup, sign-in, product create/edit/archive, SKU/category/price/visibility, stock adjustments and low-stock warnings, CSV exports, store copy/contact settings, and an orders placeholder. Generated sample photos are in `assets/`; sample prices/stock are placeholders. Customer cart/saved items remain browser-local. No live checkout, payments, shipping, customer orders, or production hosting are configured.
- **Market assumption:** India may be the initial market because the domain is `.in`, but country, tax rules, delivery areas, and currency still need confirmation.
- **Architecture decision:** Production architecture is not chosen yet. The Python/SQLite server and password-protected admin are a local development starter, not a production deployment. Compare a hosted store (faster launch, less custom engineering) with a custom application (more flexibility, more implementation and operational responsibility) before adding real commerce.
- **Roadmap:** See [`docs/ROADMAP.md`](docs/ROADMAP.md) and the beginner-friendly PDF with an order flowchart at [`docs/Markettech_Beginner_Roadmap.pdf`](docs/Markettech_Beginner_Roadmap.pdf).

When continuing this project, read this file and the roadmap first. Do not assume payment, shipping, tax, hosting, or domain configuration is already in place. Never put passwords, API keys, or other secrets in this file or in chat; configure them through the relevant hosting/provider secret settings.
