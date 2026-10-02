# Markettech.in E-commerce Roadmap

**Purpose:** Build a dependable, mobile-first online store for the owner's kitchen and household products, using the owner's domain `markettech.in`.

For a plain-language overview and order flowchart, see the [beginner-friendly roadmap PDF](Markettech_Beginner_Roadmap.pdf).

## Starting point and assumptions

- The responsive storefront in `index.html`, `styles.css`, and `app.js` reads product and stock data from a local Python/SQLite API (`server.py`). It supports browsing, filters, saved items, a browser-local shopping bag, and a non-transactional checkout preview.
- An owner panel at `/admin.html` supports one-time password setup, product add/edit/archive, stock adjustment and low-stock warnings, CSV exports, store copy/contact settings, and an orders placeholder. Product updates appear in the storefront.
- The sample data and local SQLite setup are for development only. There is still no production hosting, real checkout, payment, shipping, customer order processing, or live customer data. The store is not ready to accept orders.
- “Household items” is the assumed meaning of the request's “hold hold items.”
- India is a possible initial market, not a confirmed requirement. Confirm the countries/regions served before selecting tax, payment, and shipping integrations.
- The brand styling, product range, budget, fulfillment model, and technology choices are still open decisions.

## Roadmap at a glance

1. **Decide the business and platform basics** — product data, target market, fulfillment, policies, and hosted-vs-custom approach.
2. **Design the buying journey and foundation** — mobile UX, catalogue model, environments, and technical setup.
3. **Launch the MVP storefront** — browse products, add to cart, check out, pay, and receive a confirmed order.
4. **Make daily operations work** — manage products, stock, orders, shipping, cancellations, and returns.
5. **Harden and launch** — test, secure, configure `markettech.in`, monitor, and support customers.
6. **Grow after launch** — reviews, offers, customer accounts, automation, and additional sales channels based on real demand.

---

## Phase 0 — Discovery and decisions

**Goal:** Avoid building the wrong store or choosing integrations that do not fit the business.

- Define who the store serves and where it will deliver; confirm currency and launch country.
- List the first products and categories. For each, record SKU, title, description, price, tax treatment, stock, dimensions/weight, materials, care/safety information, and product photos. Identify variants such as size or color.
- Decide how orders will be packed and shipped: self-fulfillment, courier, or a fulfillment/shipping service; decide whether cash on delivery (COD) is needed.
- Select payment methods and a payment provider suitable for the confirmed market. Keep payment processing with the provider; do not store raw card details.
- Set initial policies: shipping charges and delivery estimates, cancellations, returns/refunds, damaged-item handling, privacy, and terms. Have applicable tax and consumer-law details checked by a qualified local professional.
- Choose a platform approach:
  - **Hosted commerce platform:** generally the quickest route to a functioning store, with platform/app fees and less control over internals.
  - **Custom application:** more control over UX and workflows, but the owner must budget for development, security, hosting, maintenance, and integrations.
- Establish the brand basics: logo, colors, product photography style, support email/phone, and final brand spelling.

**Exit criteria:** Confirm the launch geography, a representative starter catalogue, delivery/returns approach, payment needs, and hosted-vs-custom decision.

## Phase 1 — Experience and technical foundation

**Goal:** Create a clear, trustworthy buying experience and a foundation that can be safely extended.

- Map the journeys: home → category/search → product → cart → checkout → confirmation; also order lookup, contact, and returns.
- Design responsive pages for mobile first: home, category/listing, product detail, cart, checkout, order confirmation, help/policies, and a useful not-found/error state.
- Make product pages answer purchase questions: clear photos, price, availability, dimensions, material, care instructions, delivery/return summary, and variant selection where relevant.
- Create separate development/staging and production environments; keep secrets out of source control.
- Plan data models and access controls for products, variants/SKUs, stock, carts, customers, addresses, orders, payments, shipments, discounts, and admin users.
- Add basic accessibility, performance, search-engine metadata, analytics/consent requirements, and error logging to the design from the start.

**Exit criteria:** Approved page flow and product data format; a chosen platform/stack; test and production environments planned.

## Phase 2 — MVP: browse, buy, and confirm

**Goal:** A customer can complete a real end-to-end purchase, while the owner can manage the catalogue and orders.

### Customer-facing essentials

- Responsive home page with clear categories and featured products.
- Category pages with useful sorting and filters; product search (basic search is enough for launch).
- Product detail pages with image gallery, variants, price, availability, and shipping/returns information.
- Cart that survives normal navigation and clearly shows item quantities, prices, discounts, delivery fees, and totals.
- Guest checkout, address capture, delivery options, order summary, and clear error/retry states.
- Payment-provider checkout for the selected methods; optionally COD if operationally supported.
- Verified payment/order notifications and customer confirmation by email or another chosen channel.
- Order reference and a way to contact support or check order status.

### Owner/admin essentials

- Secure, admin-only product and category management, including price, SKU, photos, variants, and stock.
- View and update order status; search orders and export basic order data.
- Server-side validation of prices, discounts, stock, and order totals—never trust totals sent by a browser.
- Correct handling of payment-provider callbacks/webhooks, duplicate events, failed payments, and abandoned checkout. Do not mark an order paid based only on the browser's return page.
- Stock reduction/reservation rules that reduce accidental overselling.

### MVP acceptance checks

- A test customer can browse on a phone, place an order, pay in the provider's test mode, and receive the right confirmation.
- Invalid, failed, cancelled, duplicated, or delayed payment events do not create a falsely paid order.
- The owner can add/edit a product, update inventory, find an order, and update its status without developer help.
- The checkout total matches the product, discount, delivery, and applicable tax rules configured for the confirmed market.

## Phase 3 — Fulfillment and customer service

**Goal:** Make the store manageable after orders arrive.

- Order workflow for new, paid/unpaid, packed, shipped, delivered, cancelled, returned, and refunded states as applicable.
- Shipping labels, tracking links, delivery notifications, and shipping-rate integration where appropriate.
- Cancellation, partial/full refund, returns, exchanges, and damaged-item support processes.
- Low-stock warnings, stock adjustments, inventory history, and product/order CSV import/export.
- Customer-service workflow with searchable order history and clear contact information.
- Basic operational dashboard: orders to pack, delayed shipments, payment failures, returns, and low-stock products.

**Exit criteria:** A typical order can be handled from payment through delivery or refund with a documented owner workflow.

## Phase 4 — Security, readiness, and production launch

**Goal:** Operate safely on the real domain and be prepared for routine failures.

- Configure `markettech.in` DNS and HTTPS with the selected host; verify the canonical domain and redirects. Domain ownership alone does not configure hosting or DNS.
- Use least-privilege admin access, strong authentication (MFA for administrators where supported), secure sessions, rate limits, input validation, and dependency updates.
- Use a reputable payment provider and avoid storing sensitive card data. Keep production credentials in the hosting/provider secret manager, never in Git.
- Set up automated database backups and test restoring one; define a basic incident and rollback procedure.
- Add uptime/error monitoring, payment/webhook alerts, structured logs, and a support contact route.
- Test on common phones and browsers, accessibility basics, page performance, SEO metadata, sitemap/robots rules, and transactional email delivery.
- Run end-to-end tests for successful/failed payments, duplicate webhooks, low/out-of-stock products, discounts, shipping, COD (if enabled), cancellations, refunds, and returns.
- Publish accurate contact, shipping, cancellation/return, privacy, and terms pages. Confirm applicable tax, consumer protection, privacy, product labeling/safety, and invoicing requirements for the actual market with a qualified local professional.
- Start with a small controlled launch, monitor real orders and support issues, then widen promotion.

**Launch gate:** No unresolved critical security or checkout issues; backups and restore path verified; at least one end-to-end production-like order succeeds; owner knows how to fulfill, cancel, and refund orders.

## Phase 5 — Improve and grow

Prioritize these after the MVP has real traffic and customer feedback:

- Customer accounts, saved addresses, order history, wishlists, and product reviews with moderation.
- Coupons, bundles, gift cards, seasonal collections, and merchandising tools.
- Abandoned-cart and post-purchase messages with appropriate consent and frequency controls.
- Product recommendations, loyalty/referral features, and richer analytics.
- Improved search/filtering, bulk catalogue tools, and integrations with accounting/inventory systems.
- Additional languages, regions, currencies, wholesale/B2B, or marketplaces only if the business needs them.

## Suggested project setup (not yet selected)

If a custom build is chosen, a practical starting point for a small team is a TypeScript web application, a relational database such as PostgreSQL, managed object storage/CDN for product images, a payment provider's hosted/secure flow, and managed hosting with a staging environment. A framework such as Next.js is one reasonable option; the final choice should follow the required integrations and the owner's maintenance capacity. Avoid building payment processing, shipping networks, or tax calculation from scratch.

## Immediate next steps

1. Confirm the launch country/regions and currency.
2. Share an approximate number of products/variants and whether product data/photos are ready.
3. Decide whether you want the quickest hosted-store route or a custom-coded store.
4. Describe shipping/fulfillment and whether COD is required.
5. Identify preferred payment methods and whether a payment-provider account already exists.
6. Confirm that you can manage DNS for `markettech.in` (do not send passwords or secret keys in chat).

Once these are known, turn this roadmap into a scoped MVP backlog and start with the catalogue and checkout flow.
