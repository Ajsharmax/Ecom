# Markettech.in — Project Context

Use this file as the durable project memory for future work in this repository.

- **Working brand:** Markettech (name styling is provisional)
- **Domain:** `markettech.in` — the owner says this is their domain. DNS/registrar access and setup have not been verified.
- **Business:** An e-commerce store for the owner's kitchen and household items.
- **Current repository state:** A responsive, static storefront prototype is implemented in `index.html`, `styles.css`, and `app.js`, with AI-generated sample product imagery in `assets/`. Sample catalogue/INR prices are placeholders; the bag/saved list use browser-local storage only. There is no backend, database, owner admin, live payment, or shipping integration. Checkout is deliberately a demo and cannot accept orders.
- **Market assumption:** India may be the initial market because the domain is `.in`, but country, tax rules, delivery areas, and currency still need confirmation.
- **Architecture decision:** Production architecture is not chosen yet. The current no-dependency HTML/CSS/JavaScript prototype is only for visual and interaction review. Compare a hosted store (faster launch, less custom engineering) with a custom application (more flexibility, more implementation and operational responsibility) before adding real commerce.
- **Roadmap:** See [`docs/ROADMAP.md`](docs/ROADMAP.md) and the beginner-friendly PDF with an order flowchart at [`docs/Markettech_Beginner_Roadmap.pdf`](docs/Markettech_Beginner_Roadmap.pdf).

When continuing this project, read this file and the roadmap first. Do not assume payment, shipping, tax, hosting, or domain configuration is already in place. Never put passwords, API keys, or other secrets in this file or in chat; configure them through the relevant hosting/provider secret settings.
