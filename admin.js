const API = '/api';
const IMAGE_CHOICES = [
  ['assets/product-prep.jpg', 'Acacia prep board'],
  ['assets/product-storage.jpg', 'Pantry jars'],
  ['assets/product-organizer.jpg', 'Sink organiser'],
  ['assets/product-textiles.jpg', 'Cotton towels'],
  ['assets/product-utensils.jpg', 'Bamboo utensils'],
  ['assets/product-basket.jpg', 'Woven basket']
];
const FULFILLMENT_STATES = ['new', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const PAGE_META = {
  overview: { title: 'Overview', eyebrow: 'YOUR STORE AT A GLANCE' },
  products: { title: 'Products', eyebrow: 'YOUR CATALOGUE' },
  inventory: { title: 'Inventory', eyebrow: 'STOCK CONTROL' },
  orders: { title: 'Orders', eyebrow: 'CUSTOMER PURCHASES' },
  settings: { title: 'Store settings', eyebrow: 'YOUR STOREFRONT DETAILS' }
};

const authView = document.getElementById('auth-view');
const adminShell = document.getElementById('admin-shell');
const authAlert = document.getElementById('auth-alert');
const content = document.getElementById('admin-content');
const editorDialog = document.getElementById('product-editor-dialog');
const toast = document.getElementById('admin-toast');
let activePage = 'overview';
let adminProducts = [];
let toastTimer;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function money(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount) || 0);
}

function friendlyDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function relativeTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function showAuthMessage(message, success = false) {
  authAlert.textContent = message;
  authAlert.hidden = false;
  authAlert.classList.toggle('is-success', success);
}

function clearAuthMessage() {
  authAlert.textContent = '';
  authAlert.hidden = true;
  authAlert.classList.remove('is-success');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

async function initialiseAuth() {
  try {
    const status = await api('/auth/status');
    if (status.setupRequired) {
      showAuthMode('setup');
      return;
    }
    const session = await api('/auth/me');
    if (session.authenticated) {
      await enterAdmin();
    } else {
      showAuthMode('login');
    }
  } catch (error) {
    showAuthMode('login');
    showAuthMessage('The admin service is not available. Start the Markettech server and refresh this page.');
  }
}

function showAuthMode(mode) {
  authView.hidden = false;
  adminShell.hidden = true;
  document.getElementById('setup-panel').hidden = mode !== 'setup';
  document.getElementById('login-panel').hidden = mode !== 'login';
  clearAuthMessage();
  if (mode === 'setup') {
    document.getElementById('auth-title').textContent = 'Set up your owner access.';
    document.getElementById('auth-intro').textContent = 'Create the password that protects your store-management tools.';
    document.getElementById('setup-password').focus();
  } else {
    document.getElementById('auth-title').textContent = 'Your store, in your hands.';
    document.getElementById('auth-intro').textContent = 'Sign in to manage products, inventory and store details.';
    document.getElementById('login-password').focus();
  }
}

async function enterAdmin() {
  authView.hidden = true;
  adminShell.hidden = false;
  await loadPage('overview');
}

async function submitAuthForm(form, endpoint) {
  clearAuthMessage();
  const values = Object.fromEntries(new FormData(form).entries());
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = endpoint.endsWith('setup') ? 'Creating secure owner account…' : 'Signing in…';
  try {
    await api(endpoint, { method: 'POST', body: JSON.stringify(values) });
    form.reset();
    await enterAdmin();
  } catch (error) {
    showAuthMessage(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = endpoint.endsWith('setup') ? 'Create owner account <span aria-hidden="true">&#8594;</span>' : 'Sign in to the store <span aria-hidden="true">&#8594;</span>';
  }
}

document.getElementById('setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAuthForm(event.currentTarget, '/auth/setup');
});
document.getElementById('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAuthForm(event.currentTarget, '/auth/login');
});

document.getElementById('logout-button').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST', body: '{}' }); } catch { /* The local session will expire on restart. */ }
  showAuthMode('login');
  showAuthMessage('You have signed out.', true);
});

function setActiveNavigation(page) {
  activePage = page;
  document.querySelectorAll('.admin-nav-link').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGE_META[page]?.title || 'Store admin';
  document.getElementById('topbar-eyebrow').textContent = `MARKETTECH.IN / ${PAGE_META[page]?.eyebrow || 'OWNER'}`;
}

async function loadPage(page) {
  setActiveNavigation(page);
  content.innerHTML = '<div class="loading-state"><span class="loading-dot"></span>Opening your store tools…</div>';
  closeMobileNavigation();
  try {
    if (page === 'overview') await renderOverview();
    if (page === 'products') await renderProductsPage();
    if (page === 'inventory') await renderInventoryPage();
    if (page === 'orders') await renderOrdersPage();
    if (page === 'settings') await renderSettingsPage();
  } catch (error) {
    if (error.status === 401) {
      showAuthMode('login');
      showAuthMessage('Your owner session ended. Please sign in again.');
      return;
    }
    content.innerHTML = `<div class="page-error"><strong>We couldn't open this section.</strong><p>${escapeHTML(error.message)}</p><button class="admin-button subtle" type="button" data-reload-page>Try again</button></div>`;
  }
}

function welcomeBlock(eyebrow, title, description, button = '') {
  return `<div class="page-welcome"><div><p class="admin-eyebrow">${escapeHTML(eyebrow)}</p><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>${button}</div>`;
}

function metricCard(label, value, note, attention = false) {
  return `<div class="metric-card${attention ? ' attention' : ''}"><span class="metric-label">${escapeHTML(label)}</span><strong class="metric-number">${escapeHTML(value)}</strong><span class="metric-note">${escapeHTML(note)}</span></div>`;
}

async function renderOverview() {
  const [summary, activity] = await Promise.all([
    api('/admin/summary'),
    api('/admin/activity')
  ]);
  document.getElementById('nav-low-stock').textContent = String(summary.lowStock || 0);
  document.getElementById('nav-order-count').textContent = String(summary.unfulfilledOrders || 0);
  const lowRows = summary.lowStockProducts || [];
  const lowStockHtml = lowRows.length ? lowRows.map((product) => `
    <div class="low-stock-item">
      <div class="low-stock-product"><img src="/${escapeHTML(product.image)}" alt=""><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.sku)} · ${escapeHTML(product.categoryLabel)}</small></span></div>
      <span class="stock-pill${product.stock === 0 ? ' out' : ''}">${product.stock === 0 ? 'Out' : `${product.stock} left`}</span>
      <button class="admin-button subtle small-button" type="button" data-page="inventory">Adjust</button>
    </div>`).join('') : '<div class="empty-inline">Nothing is running low. Stock warnings will show here.</div>';
  const activityHtml = activity.length ? activity.map((entry) => `
    <div class="activity-item"><span class="activity-icon" aria-hidden="true">${activityMark(entry.action)}</span><span><strong>${escapeHTML(entry.action)}${entry.detail ? ` · ${escapeHTML(entry.detail)}` : ''}</strong><small>${escapeHTML(entry.entity)} · ${escapeHTML(relativeTime(entry.created_at))}</small></span></div>`).join('') : '<div class="empty-inline">Your recent product and stock changes will appear here.</div>';

  content.innerHTML = `
    ${welcomeBlock('YOUR STORE AT A GLANCE', 'Good day, owner.', 'Here is a simple snapshot of your sample storefront.', '<button class="admin-button primary" type="button" data-add-product>+ Add a product</button>')}
    <div class="metric-grid">
      ${metricCard('PRODUCTS IN CATALOGUE', summary.products, `${summary.activeProducts} visible in the sample shop`)}
      ${metricCard('LOW-STOCK WARNINGS', summary.lowStock, 'At or below the warning level', summary.lowStock > 0)}
      ${metricCard('ORDERS TO FULFIL', summary.unfulfilledOrders, 'Orders waiting to be packed')}
      ${metricCard('ALL ORDERS', summary.orders, 'Real checkout is not connected yet')}
    </div>
    <div class="dashboard-grid">
      <section class="panel-card"><div class="panel-head"><div><h3>Stock to keep an eye on</h3><p>Low quantities appear here automatically.</p></div><button class="panel-link" type="button" data-page="inventory">View inventory &#8594;</button></div><div class="panel-body">${lowStockHtml}</div></section>
      <section class="panel-card"><div class="panel-head"><div><h3>Recent changes</h3><p>A simple history of your admin actions.</p></div></div><div class="panel-body activity-list">${activityHtml}</div></section>
    </div>
    <div class="demo-notice"><span class="notice-icon" aria-hidden="true">i</span><span><strong>Preview mode:</strong> you can edit sample products and stock here. Customer checkout, payments, and live orders are not connected yet.</span></div>`;
}

function activityMark(action) {
  if (/stock/i.test(action)) return '&#8593;';
  if (/setting/i.test(action)) return '&#9881;';
  if (/owner/i.test(action)) return '&#9679;';
  return '&#10003;';
}

async function fetchProducts() {
  adminProducts = await api('/admin/products');
  return adminProducts;
}

async function renderProductsPage() {
  await fetchProducts();
  content.innerHTML = `
    ${welcomeBlock('YOUR CATALOGUE', 'Products, all in one place.', 'Add, edit, show or archive products. Changes appear in the sample storefront.', '<button class="admin-button primary" type="button" data-add-product>+ Add a product</button>')}
    <div class="page-toolbar"><div class="toolbar-left"><input class="admin-search" id="product-search" type="search" placeholder="Search name or SKU" aria-label="Search products"><select class="admin-select" id="product-filter" aria-label="Filter products"><option value="all">All products</option><option value="active">Visible in shop</option><option value="archived">Archived</option><option value="low">Low stock</option></select></div><div class="toolbar-right"><button class="admin-button subtle" type="button" data-export-products>Download CSV</button></div></div>
    <div class="table-card"><div class="table-scroll"><table class="admin-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Store status</th><th></th></tr></thead><tbody id="product-table-body"></tbody></table></div><div class="table-footer"><span id="product-table-count"></span><span>Sample prices shown in INR</span></div></div>`;
  renderProductRows();
}

function filteredProducts() {
  const query = (document.getElementById('product-search')?.value || '').trim().toLowerCase();
  const filter = document.getElementById('product-filter')?.value || 'all';
  return adminProducts.filter((product) => {
    const matchesQuery = !query || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query);
    const matchesFilter = filter === 'all' ||
      (filter === 'active' && product.active) ||
      (filter === 'archived' && !product.active) ||
      (filter === 'low' && product.active && product.lowStock);
    return matchesQuery && matchesFilter;
  });
}

function renderProductRows() {
  const body = document.getElementById('product-table-body');
  if (!body) return;
  const rows = filteredProducts();
  body.innerHTML = rows.length ? rows.map((product) => `
    <tr>
      <td><div class="table-product"><img src="/${escapeHTML(product.image)}" alt=""><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.badge || 'No label')}</small></span></div></td>
      <td>${escapeHTML(product.sku)}</td><td>${escapeHTML(product.categoryLabel)}</td><td class="table-price">${money(product.price)}</td>
      <td><span class="stock-pill${product.stock === 0 ? ' out' : product.lowStock ? '' : ' ok'}">${product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}</span></td>
      <td><span class="status-chip${product.active ? '' : ' hidden-status'}">${product.active ? 'Visible' : 'Archived'}</span></td>
      <td><div class="table-actions"><button class="table-action" type="button" data-edit-product="${escapeHTML(product.id)}">Edit</button>${product.active ? `<button class="table-action archive" type="button" data-archive-product="${escapeHTML(product.id)}">Archive</button>` : ''}</div></td>
    </tr>`).join('') : '<tr><td colspan="7"><div class="empty-inline">No products match this view. Try another filter or add a product.</div></td></tr>';
  document.getElementById('product-table-count').textContent = `${rows.length} of ${adminProducts.length} products shown`;
}

async function renderInventoryPage() {
  await fetchProducts();
  document.getElementById('nav-low-stock').textContent = String(adminProducts.filter((item) => item.active && item.lowStock).length);
  content.innerHTML = `
    ${welcomeBlock('STOCK CONTROL', 'Know what is on your shelf.', 'Change stock counts here. A low-stock warning appears at the number set for each item.', '<button class="admin-button subtle" type="button" data-export-inventory>Download stock CSV</button>')}
    <div class="page-toolbar"><div class="toolbar-left"><input class="admin-search" id="inventory-search" type="search" placeholder="Search product or SKU" aria-label="Search inventory"><select class="admin-select" id="inventory-filter" aria-label="Filter inventory"><option value="all">All visible products</option><option value="low">Low stock only</option><option value="out">Out of stock</option></select></div><div class="toolbar-right"><span class="stock-pill">Low stock warning is per product</span></div></div>
    <div class="table-card"><div class="stock-filter-note">Use the + and − buttons to make a quick stock adjustment. Use Edit to change the warning level or product details.</div><div class="stock-table-wrap"><div class="stock-row stock-row-head"><span>PRODUCT</span><span>SKU</span><span>QUANTITY</span><span>WARNING AT</span><span>ACTION</span></div><div id="inventory-list"></div></div><div class="table-footer"><span id="inventory-count"></span><span>Stock changes save to the store database</span></div></div>`;
  renderInventoryRows();
}

function filteredInventory() {
  const query = (document.getElementById('inventory-search')?.value || '').trim().toLowerCase();
  const filter = document.getElementById('inventory-filter')?.value || 'all';
  return adminProducts.filter((item) => {
    if (!item.active) return false;
    const searchMatch = !query || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(query);
    const filterMatch = filter === 'all' || (filter === 'low' && item.lowStock && item.stock > 0) || (filter === 'out' && item.stock === 0);
    return searchMatch && filterMatch;
  });
}

function renderInventoryRows() {
  const list = document.getElementById('inventory-list');
  if (!list) return;
  const rows = filteredInventory();
  list.innerHTML = rows.length ? rows.map((product) => `
    <div class="stock-row">
      <div class="stock-product"><img src="/${escapeHTML(product.image)}" alt=""><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.categoryLabel)}${product.stock === 0 ? ' · Out of stock' : product.lowStock ? ' · Reorder soon' : ''}</small></span></div>
      <span class="stock-sku">${escapeHTML(product.sku)}</span>
      <span class="stock-control"><button type="button" data-stock-id="${escapeHTML(product.id)}" data-stock-delta="-1" aria-label="Remove one ${escapeHTML(product.name)} from stock" ${product.stock <= 0 ? 'disabled' : ''}>−</button><strong>${product.stock}</strong><button type="button" data-stock-id="${escapeHTML(product.id)}" data-stock-delta="1" aria-label="Add one ${escapeHTML(product.name)} to stock">+</button></span>
      <span class="stock-threshold">Warn at ${product.lowStockThreshold} left</span>
      <button class="table-action" type="button" data-edit-product="${escapeHTML(product.id)}">Edit item</button>
    </div>`).join('') : '<div class="empty-inline">No products match this inventory view.</div>';
  document.getElementById('inventory-count').textContent = `${rows.length} visible products`;
}

async function renderOrdersPage() {
  const orders = await api('/admin/orders');
  document.getElementById('nav-order-count').textContent = String(orders.filter((order) => ['new', 'processing', 'packed'].includes(order.fulfillment_status)).length);
  const ordersContent = orders.length ? `
    <div class="table-card"><div class="table-scroll"><table class="admin-table order-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfilment</th><th>Date</th></tr></thead><tbody>${orders.map((order) => `
      <tr><td><strong>${escapeHTML(order.order_number)}</strong></td><td>${escapeHTML(order.customer_name)}<br><small>${escapeHTML(order.email || order.phone || '')}</small></td><td class="table-price">${money(order.subtotal)}</td><td>${escapeHTML(order.payment_status)}</td><td><select class="order-status-select" data-order-status="${escapeHTML(order.id)}" aria-label="Fulfilment status for ${escapeHTML(order.order_number)}">${FULFILLMENT_STATES.map((status) => `<option value="${status}" ${status === order.fulfillment_status ? 'selected' : ''}>${status[0].toUpperCase()}${status.slice(1)}</option>`).join('')}</select></td><td>${friendlyDate(order.created_at)}</td></tr>`).join('')}</tbody></table></div></div>` : `
    <div class="table-card order-empty"><span class="order-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v17H5zM8 8h8M8 12h8M8 16h5"/></svg></span><h3>No orders yet</h3><p>That's expected: customer checkout and payments are not connected in this preview. When real checkout is built, orders will appear here so you can review and update their status.</p></div>`;
  content.innerHTML = `
    ${welcomeBlock('CUSTOMER PURCHASES', 'Orders will live here.', 'Review incoming orders and update packing or delivery status once checkout is connected.')}
    <div class="demo-notice"><span class="notice-icon" aria-hidden="true">i</span><span><strong>No live orders:</strong> the storefront preview cannot place an order or collect customer information.</span></div>
    ${ordersContent}`;
}

async function renderSettingsPage() {
  const settings = await api('/admin/settings');
  content.innerHTML = `
    ${welcomeBlock('YOUR STOREFRONT DETAILS', 'Set the tone of your shop.', 'Change the announcement and a couple of homepage details. Your updates appear on the storefront preview.')}
    <div class="settings-grid">
      <section class="settings-card"><h3>Homepage wording</h3><p>These are safe text settings. Product and payment settings live in their own sections.</p>
        <form class="admin-form" id="settings-form">
          <div class="field full"><label for="setting-announcement">Top-of-page announcement</label><input id="setting-announcement" name="announcement" maxlength="180" value="${escapeHTML(settings.announcement)}" required><span class="help-text">Keep the preview/payment notice visible until real checkout is ready.</span></div>
          <div class="field full"><label for="setting-hero">Short introduction on the home page</label><textarea id="setting-hero" name="hero_description" maxlength="300" required>${escapeHTML(settings.hero_description)}</textarea></div>
          <div class="field full"><label for="setting-about">About section</label><textarea id="setting-about" name="about_description" maxlength="600" required>${escapeHTML(settings.about_description)}</textarea></div>
          <div class="field full"><label for="setting-email">Customer support email (optional)</label><input id="setting-email" name="support_email" type="email" maxlength="160" value="${escapeHTML(settings.support_email)}" placeholder="you@example.com"><span class="help-text">Use an address you are ready to monitor. Leave blank to keep the contact placeholder.</span></div>
          <div class="field full settings-save-row"><span class="settings-saved-note">Changes are stored in the local store database.</span><button class="admin-button primary" type="submit">Save storefront details <span aria-hidden="true">&#8594;</span></button></div>
        </form>
      </section>
      <aside class="settings-info"><h3>Before you open to customers</h3><p>The preview has no live payment, shipping, or order system. Do not replace its sample information with promises until the real service is ready.</p><ul><li>Choose the country, currency, and tax setup.</li><li>Connect a payment provider and test refunds.</li><li>Confirm delivery prices, timing, and returns.</li><li>Add your real contact and policy pages.</li><li>Back up the database and protect the admin login.</li></ul></aside>
    </div>`;
}

function openProductEditor(product = null) {
  const isEdit = Boolean(product);
  const item = product || {
    name: '', sku: '', category: 'Kitchen', description: '', details: '', price: 0, stock: 0,
    lowStockThreshold: 5, image: IMAGE_CHOICES[0][0], imageAlt: '', badge: '', active: true
  };
  editorDialog.innerHTML = `
    <div class="editor-head"><div><p class="admin-eyebrow">${isEdit ? 'EDIT CATALOGUE ITEM' : 'ADD TO CATALOGUE'}</p><h2 id="product-editor-title">${isEdit ? 'Update a product' : 'Add a product'}</h2></div><button class="editor-close" type="button" data-close-editor aria-label="Close product form">×</button></div>
    <div class="editor-body">
      <div class="editor-product-preview"><img id="editor-image-preview" src="/${escapeHTML(item.image)}" alt=""><span>Choose one of the supplied sample photos. Uploading your own product images can be added later.</span></div>
      <div class="dialog-error" id="editor-error" hidden></div>
      <form class="admin-form" id="product-form">
        <div class="field"><label for="product-name">Product name *</label><input id="product-name" name="name" maxlength="120" value="${escapeHTML(item.name)}" required></div>
        <div class="field"><label for="product-sku">SKU / stock code *</label><input id="product-sku" name="sku" maxlength="40" value="${escapeHTML(item.sku)}" required><span class="help-text">A short unique code helps identify this item.</span></div>
        <div class="field"><label for="product-category">Category *</label><select id="product-category" name="category"><option value="Kitchen" ${item.category === 'Kitchen' ? 'selected' : ''}>Kitchen</option><option value="Storage" ${item.category === 'Storage' ? 'selected' : ''}>Storage</option><option value="Home" ${item.category === 'Home' ? 'selected' : ''}>Home &amp; living</option></select></div>
        <div class="field"><label for="product-price">Price in rupees *</label><input id="product-price" name="price" type="number" min="0" max="10000000" step="1" value="${Number(item.price) || 0}" required></div>
        <div class="field"><label for="product-stock">Quantity in stock *</label><input id="product-stock" name="stock" type="number" min="0" max="1000000" step="1" value="${Number(item.stock) || 0}" required></div>
        <div class="field"><label for="product-threshold">Low-stock warning at</label><input id="product-threshold" name="lowStockThreshold" type="number" min="0" max="1000000" step="1" value="${Number(item.lowStockThreshold) || 0}" required><span class="help-text">The dashboard warns you at this quantity or below.</span></div>
        <div class="field"><label for="product-badge">Small product label</label><input id="product-badge" name="badge" maxlength="40" value="${escapeHTML(item.badge || '')}" placeholder="e.g. Kitchen essential"></div>
        <div class="field"><label for="product-image">Product photo</label><select id="product-image" name="image">${IMAGE_CHOICES.map(([path,label]) => `<option value="${escapeHTML(path)}" ${path === item.image ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select></div>
        <div class="field full"><label for="product-description">Short description</label><textarea id="product-description" name="description" maxlength="600" placeholder="What should shoppers know about this item?">${escapeHTML(item.description || '')}</textarea></div>
        <div class="field full"><label for="product-details">Materials, size, care, or other details</label><textarea id="product-details" name="details" maxlength="300" placeholder="Add accurate details. Do not guess product safety or material claims.">${escapeHTML(item.details || '')}</textarea></div>
        <div class="field full"><label for="product-alt">Photo description for accessibility</label><input id="product-alt" name="imageAlt" maxlength="180" value="${escapeHTML(item.imageAlt || '')}" placeholder="Describe the product photo"></div>
        <div class="form-checkbox"><input id="product-active" name="active" type="checkbox" ${item.active ? 'checked' : ''}><label for="product-active">Show this product in the storefront</label></div>
        <div class="field full editor-actions"><button class="admin-button subtle" type="button" data-close-editor>Cancel</button><div class="editor-actions-right"><button class="admin-button primary" type="submit">${isEdit ? 'Save changes' : 'Add product'} <span aria-hidden="true">&#8594;</span></button></div></div>
      </form>
    </div>`;
  editorDialog.showModal();
  const imageSelect = document.getElementById('product-image');
  imageSelect.addEventListener('change', () => { document.getElementById('editor-image-preview').src = `/${imageSelect.value}`; });
  document.getElementById('product-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    values.price = Number(values.price);
    values.stock = Number(values.stock);
    values.lowStockThreshold = Number(values.lowStockThreshold);
    values.active = form.elements.active.checked;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving product…';
    const errorBox = document.getElementById('editor-error');
    errorBox.hidden = true;
    try {
      if (isEdit) {
        await api(`/admin/products/${encodeURIComponent(item.id)}`, { method: 'PUT', body: JSON.stringify(values) });
      } else {
        await api('/admin/products', { method: 'POST', body: JSON.stringify(values) });
      }
      editorDialog.close();
      showToast(isEdit ? 'Product updated. The storefront will refresh its catalogue.' : 'Product added to the catalogue.');
      await loadPage(activePage);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submitButton.disabled = false;
      submitButton.innerHTML = `${isEdit ? 'Save changes' : 'Add product'} <span aria-hidden="true">&#8594;</span>`;
    }
  });
}

async function archiveProduct(id) {
  const product = adminProducts.find((item) => item.id === id);
  if (!product || !window.confirm(`Archive “${product.name}”? It will disappear from the sample shop but remain in your admin records.`)) return;
  try {
    await api(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('Product archived. You can edit it later to show it again.');
    await loadPage(activePage);
  } catch (error) { showToast(error.message); }
}

async function adjustStock(id, delta) {
  try {
    const product = adminProducts.find((item) => item.id === id);
    await api(`/admin/inventory/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ delta }) });
    showToast(`${product?.name || 'Product'} stock updated.`);
    await loadPage(activePage);
  } catch (error) { showToast(error.message); }
}

async function saveSettings(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/admin/settings', { method: 'PUT', body: JSON.stringify(values) });
    showToast('Storefront details saved. The shop preview is updated.');
    document.querySelector('.settings-saved-note').textContent = 'Saved just now.';
  } catch (error) { showToast(error.message); }
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportProducts() {
  const rows = [['Name','SKU','Category','Price INR','Stock','Low stock warning','Visible in shop'], ...adminProducts.map((item) => [item.name,item.sku,item.category,item.price,item.stock,item.lowStockThreshold,item.active ? 'Yes' : 'No'])];
  downloadCSV('markettech-products.csv', rows);
  showToast('Product list downloaded as a CSV file.');
}

function exportInventory() {
  const rows = [['Name','SKU','Category','Quantity','Low stock warning'], ...adminProducts.filter((item) => item.active).map((item) => [item.name,item.sku,item.category,item.stock,item.lowStockThreshold])];
  downloadCSV('markettech-inventory.csv', rows);
  showToast('Stock list downloaded as a CSV file.');
}

function closeMobileNavigation() {
  document.getElementById('admin-sidebar').classList.remove('is-open');
  document.getElementById('sidebar-backdrop').hidden = true;
  document.getElementById('mobile-sidebar-toggle').setAttribute('aria-expanded', 'false');
}

// Navigation is deliberately simple: choose a section, and the matching tool opens.
document.getElementById('admin-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (button) loadPage(button.dataset.page);
});
content.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page]');
  const addButton = event.target.closest('[data-add-product]');
  const editButton = event.target.closest('[data-edit-product]');
  const archiveButton = event.target.closest('[data-archive-product]');
  const stockButton = event.target.closest('[data-stock-id]');
  const exportButton = event.target.closest('[data-export-products], [data-export-inventory]');
  const reloadButton = event.target.closest('[data-reload-page]');
  if (pageButton) { loadPage(pageButton.dataset.page); return; }
  if (addButton) { openProductEditor(); return; }
  if (editButton) { openProductEditor(adminProducts.find((item) => item.id === editButton.dataset.editProduct)); return; }
  if (archiveButton) { archiveProduct(archiveButton.dataset.archiveProduct); return; }
  if (stockButton) { adjustStock(stockButton.dataset.stockId, Number(stockButton.dataset.stockDelta)); return; }
  if (exportButton) { exportButton.hasAttribute('data-export-inventory') ? exportInventory() : exportProducts(); return; }
  if (reloadButton) loadPage(activePage);
});
content.addEventListener('input', (event) => {
  if (event.target.id === 'product-search') renderProductRows();
  if (event.target.id === 'inventory-search') renderInventoryRows();
});
content.addEventListener('change', async (event) => {
  if (event.target.id === 'product-filter') renderProductRows();
  if (event.target.id === 'inventory-filter') renderInventoryRows();
  if (event.target.matches('[data-order-status]')) {
    const orderId = event.target.dataset.orderStatus;
    try {
      await api(`/admin/orders/${encodeURIComponent(orderId)}`, { method: 'PUT', body: JSON.stringify({ fulfillmentStatus: event.target.value }) });
      showToast('Order status updated.');
    } catch (error) { showToast(error.message); await renderOrdersPage(); }
  }
});
content.addEventListener('submit', (event) => {
  if (event.target.id === 'settings-form') {
    event.preventDefault();
    saveSettings(event.target);
  }
});

document.getElementById('mobile-sidebar-toggle').addEventListener('click', (event) => {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const open = !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', open);
  backdrop.hidden = !open;
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileNavigation);
editorDialog.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-editor]')) editorDialog.close();
});

// Load this section after the authentication form is wired up.
initialiseAuth();
