const products = [
  {
    id: 'acacia-board',
    name: 'Acacia Prep Board',
    category: 'Kitchen',
    categoryLabel: 'Kitchen essentials',
    description: 'A warm, sturdy everyday board for chopping, serving and the little rituals around a good meal.',
    details: 'Material: acacia wood · Sample listing · Product dimensions to be confirmed',
    price: 899,
    image: 'assets/product-prep.jpg',
    imageAlt: 'Natural acacia chopping board with wooden kitchen tools',
    badge: 'A DAILY FAVOURITE'
  },
  {
    id: 'pantry-jars',
    name: 'Clear Pantry Jar Trio',
    category: 'Storage',
    categoryLabel: 'Smart storage',
    description: 'A simple way to keep pantry staples visible, tidy and close at hand.',
    details: 'Set of 3 · Glass jars with natural-look lids · Capacity to be confirmed',
    price: 749,
    image: 'assets/product-storage.jpg',
    imageAlt: 'Three clear pantry jars with wood lids',
    badge: 'TIDY THE PANTRY'
  },
  {
    id: 'sage-caddy',
    name: 'Sage Sink Caddy',
    category: 'Home',
    categoryLabel: 'Home & living',
    description: 'A neat home for the small things that make the daily clean-up a little easier.',
    details: 'Sample listing · Exact material and size to be confirmed',
    price: 449,
    image: 'assets/product-organizer.jpg',
    imageAlt: 'Sage-green sink organizer with a sponge and dish brush',
    badge: 'A TIDIER SINK'
  },
  {
    id: 'cotton-towels',
    name: 'Everyday Cotton Towels',
    category: 'Kitchen',
    categoryLabel: 'Kitchen essentials',
    description: 'Soft, useful kitchen towels in a calm palette made for everyday cooking and clean-up.',
    details: 'Sample set · Fabric, count and care instructions to be confirmed',
    price: 599,
    image: 'assets/product-textiles.jpg',
    imageAlt: 'Folded cotton kitchen towels in cream, sage and terracotta',
    badge: 'SOFT & USEFUL'
  },
  {
    id: 'bamboo-utensils',
    name: 'Bamboo Utensil Set',
    category: 'Kitchen',
    categoryLabel: 'Kitchen essentials',
    description: 'Everyday cooking tools with a natural look, ready to sit by the stove.',
    details: 'Sample listing · Set contents and care instructions to be confirmed',
    price: 699,
    image: 'assets/product-utensils.jpg',
    imageAlt: 'Bamboo cooking utensils standing in a cream ceramic crock',
    badge: 'READY TO COOK'
  },
  {
    id: 'woven-basket',
    name: 'Woven Pantry Basket',
    category: 'Storage',
    categoryLabel: 'Smart storage',
    description: 'A versatile basket to bring a little order to open shelves and kitchen counters.',
    details: 'Sample listing · Material, dimensions and care to be confirmed',
    price: 799,
    image: 'assets/product-basket.jpg',
    imageAlt: 'Woven natural-fiber basket with pantry jars and a folded towel',
    badge: 'MAKE SPACE'
  }
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});
const productById = new Map(products.map((product) => [product.id, product]));
const storageKeys = {
  cart: 'markettech-preview-cart-v1',
  saved: 'markettech-preview-saved-v1'
};

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

let cart = readStored(storageKeys.cart, {});
let saved = new Set(readStored(storageKeys.saved, []));
let selectedCategory = 'all';
let searchTerm = '';
let sortMode = 'featured';
let showingSaved = false;
let toastTimer;

const productGrid = document.getElementById('product-grid');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const cartDrawer = document.getElementById('cart-drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const productDialog = document.getElementById('product-dialog');
const checkoutDialog = document.getElementById('checkout-dialog');
const toast = document.getElementById('toast');

function saveCart() {
  try { localStorage.setItem(storageKeys.cart, JSON.stringify(cart)); } catch { /* Preview still works until the tab closes. */ }
}

function saveSaved() {
  try { localStorage.setItem(storageKeys.saved, JSON.stringify([...saved])); } catch { /* Optional preview feature. */ }
}

function formatPrice(amount) {
  return currency.format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function iconHeart(filled = false) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="heart-icon${filled ? ' is-filled' : ''}"><path d="M20.3 8.8c0 4.1-8.3 10-8.3 10S3.7 12.9 3.7 8.8A4.4 4.4 0 0 1 12 6.5a4.4 4.4 0 0 1 8.3 2.3Z"/></svg>`;
}

function renderProductCard(product) {
  const isSaved = saved.has(product.id);
  return `
    <article class="product-card">
      <div class="product-image-wrap">
        <button class="product-image-button" type="button" data-product-detail="${escapeHTML(product.id)}" aria-label="View details for ${escapeHTML(product.name)}">
          <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.imageAlt)}" loading="lazy">
        </button>
        <span class="product-tag">${escapeHTML(product.badge)}</span>
        <button class="save-product${isSaved ? ' is-saved' : ''}" type="button" data-save-product="${escapeHTML(product.id)}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Remove' : 'Save'} ${escapeHTML(product.name)}">
          ${iconHeart(isSaved)}
        </button>
        <button class="quick-view" type="button" data-product-detail="${escapeHTML(product.id)}">Quick view <span aria-hidden="true">&#8599;</span></button>
      </div>
      <div class="product-info">
        <div class="product-meta"><span>${escapeHTML(product.categoryLabel)}</span><span class="meta-spark" aria-hidden="true">✳</span></div>
        <button class="product-name" type="button" data-product-detail="${escapeHTML(product.id)}">${escapeHTML(product.name)}</button>
        <div class="product-bottom"><span class="product-price">${formatPrice(product.price)}</span><span class="sample-label">sample price</span>
          <button class="add-button" type="button" data-add-product="${escapeHTML(product.id)}" aria-label="Add ${escapeHTML(product.name)} to bag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        </div>
      </div>
    </article>`;
}

function getVisibleProducts() {
  let visible = products.filter((product) => {
    const categoryMatches = selectedCategory === 'all' || product.category === selectedCategory;
    const savedMatches = !showingSaved || saved.has(product.id);
    const haystack = `${product.name} ${product.categoryLabel} ${product.description}`.toLowerCase();
    const searchMatches = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    return categoryMatches && savedMatches && searchMatches;
  });

  if (sortMode === 'price-low') visible.sort((a, b) => a.price - b.price);
  if (sortMode === 'price-high') visible.sort((a, b) => b.price - a.price);
  if (sortMode === 'name') visible.sort((a, b) => a.name.localeCompare(b.name));
  return visible;
}

function renderProducts() {
  const visible = getVisibleProducts();
  const heading = document.getElementById('shop-heading');
  const subtitle = document.querySelector('.section-subtitle');
  const count = document.getElementById('results-count');

  if (showingSaved) {
    heading.innerHTML = 'Things you <em>saved.</em>';
    subtitle.textContent = 'A little list of things you would like to come back to.';
  } else {
    heading.innerHTML = selectedCategory === 'all' ? 'Little things, <em>well chosen.</em>' : `${escapeHTML(categoryTitle(selectedCategory))}, <em>well chosen.</em>`;
    subtitle.textContent = searchTerm ? `Showing matches for “${searchTerm.replace(/[<>]/g, '')}” in the sample collection.` : 'A sample collection to explore the shop experience. Product names and prices are placeholders for now.';
  }

  count.textContent = `${visible.length} ${visible.length === 1 ? 'sample piece' : 'sample pieces'}`;
  if (!visible.length) {
    const message = showingSaved ? 'Nothing saved just yet. Tap the heart on a product to keep it here.' : 'No pieces found. Try another search or category.';
    productGrid.innerHTML = `<div class="empty-results"><span class="empty-results-flower" aria-hidden="true">✳</span><h3>${showingSaved ? 'Your saved list is taking shape.' : 'No matches just yet.'}</h3><p>${escapeHTML(message)}</p><button class="text-link reset-filters" type="button" data-reset-filters>Show all sample items <span aria-hidden="true">&#8594;</span></button></div>`;
  } else {
    productGrid.innerHTML = visible.map(renderProductCard).join('');
  }
  updateSavedCount();
}

function categoryTitle(category) {
  return ({ Kitchen: 'Kitchen essentials', Storage: 'Storage finds', Home: 'Home & living' })[category] || 'The collection';
}

function updateFilterUI() {
  filterButtons.forEach((button) => {
    const active = !showingSaved && button.dataset.filter === selectedCategory;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const savedToggle = document.getElementById('saved-toggle');
  savedToggle.classList.toggle('is-active', showingSaved);
  savedToggle.setAttribute('aria-pressed', String(showingSaved));
  savedToggle.setAttribute('aria-label', showingSaved ? 'Show all products' : 'Show saved items');
  savedToggle.querySelector('span:nth-of-type(1)').textContent = showingSaved ? 'All items' : 'Saved';
}

function updateSavedCount() {
  const count = document.getElementById('saved-count');
  count.textContent = String(saved.size);
  count.classList.toggle('has-items', saved.size > 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function addToCart(id, quantity = 1) {
  if (!productById.has(id)) return;
  cart[id] = (Number(cart[id]) || 0) + quantity;
  saveCart();
  renderCart();
  showToast(`${productById.get(id).name} added to your bag`);
}

function toggleSaved(id) {
  if (saved.has(id)) {
    saved.delete(id);
    showToast(`${productById.get(id).name} removed from saved items`);
  } else {
    saved.add(id);
    showToast(`${productById.get(id).name} saved for later`);
  }
  saveSaved();
  renderProducts();
  updateFilterUI();
}

function cartEntries() {
  return Object.entries(cart)
    .filter(([id, quantity]) => productById.has(id) && Number(quantity) > 0)
    .map(([id, quantity]) => ({ product: productById.get(id), quantity: Number(quantity) }));
}

function renderCart() {
  const entries = cartEntries();
  const itemCount = entries.reduce((total, entry) => total + entry.quantity, 0);
  const subtotal = entries.reduce((total, entry) => total + entry.product.price * entry.quantity, 0);
  const countEl = document.getElementById('cart-count');
  countEl.textContent = String(itemCount);
  document.getElementById('drawer-item-count').textContent = `(${itemCount})`;
  document.getElementById('cart-open').setAttribute('aria-label', `Open shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`);
  document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('cart-items').innerHTML = entries.map(({ product, quantity }) => `
    <article class="cart-item">
      <button class="cart-item-image" type="button" data-product-detail="${escapeHTML(product.id)}" aria-label="View ${escapeHTML(product.name)}"><img src="${escapeHTML(product.image)}" alt=""></button>
      <div class="cart-item-copy"><span class="cart-item-category">${escapeHTML(product.categoryLabel)}</span><button class="cart-item-name" type="button" data-product-detail="${escapeHTML(product.id)}">${escapeHTML(product.name)}</button><span class="cart-item-price">${formatPrice(product.price)}</span>
        <div class="quantity-control" aria-label="Quantity for ${escapeHTML(product.name)}">
          <button type="button" data-cart-action="minus" data-product-id="${escapeHTML(product.id)}" aria-label="Decrease quantity">−</button>
          <span>${quantity}</span>
          <button type="button" data-cart-action="plus" data-product-id="${escapeHTML(product.id)}" aria-label="Increase quantity">+</button>
        </div>
      </div>
      <button class="remove-item" type="button" data-cart-action="remove" data-product-id="${escapeHTML(product.id)}" aria-label="Remove ${escapeHTML(product.name)}">Remove</button>
    </article>`).join('');
  document.getElementById('cart-empty').hidden = entries.length > 0;
  document.getElementById('cart-summary').hidden = entries.length === 0;
}

function openCart() {
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => {
    drawerBackdrop.classList.add('is-visible');
    cartDrawer.classList.add('is-open');
  });
  cartDrawer.setAttribute('aria-hidden', 'false');
  cartDrawer.inert = false;
  document.body.classList.add('drawer-open');
  document.getElementById('cart-close').focus();
}

function closeCart() {
  drawerBackdrop.classList.remove('is-visible');
  cartDrawer.classList.remove('is-open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  cartDrawer.inert = true;
  document.body.classList.remove('drawer-open');
  setTimeout(() => { drawerBackdrop.hidden = true; }, 280);
  document.getElementById('cart-open').focus();
}

function setCategory(category) {
  selectedCategory = category;
  showingSaved = false;
  searchTerm = '';
  document.getElementById('search-input').value = '';
  document.getElementById('shop-search-input').value = '';
  updateFilterUI();
  renderProducts();
}

function openProductDialog(id) {
  const product = productById.get(id);
  if (!product) return;
  const wasAlreadyOpen = productDialog.open;
  const isSaved = saved.has(id);
  productDialog.innerHTML = `
    <button class="icon-button dialog-close" type="button" data-close-dialog aria-label="Close product details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    <div class="product-dialog-image"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.imageAlt)}"></div>
    <div class="product-dialog-copy"><p class="eyebrow">${escapeHTML(product.categoryLabel)}</p><h2 id="dialog-product-title">${escapeHTML(product.name)}</h2>
      <p class="dialog-price">${formatPrice(product.price)} <small>sample price</small></p>
      <p class="dialog-description">${escapeHTML(product.description)}</p>
      <p class="dialog-details">${escapeHTML(product.details)}</p>
      <div class="dialog-actions"><button class="button button-dark" type="button" data-add-product="${escapeHTML(product.id)}">Add to bag <span aria-hidden="true">&#8594;</span></button><button class="dialog-save${isSaved ? ' is-saved' : ''}" type="button" data-save-product="${escapeHTML(product.id)}" aria-pressed="${isSaved}">${iconHeart(isSaved)} ${isSaved ? 'Saved' : 'Save for later'}</button></div>
      <p class="dialog-sample-note">This is a sample listing. Confirm product details and stock before the real store opens.</p>
    </div>`;
  if (!wasAlreadyOpen) productDialog.showModal();
}

// Category filters and navigation.
filterButtons.forEach((button) => button.addEventListener('click', () => setCategory(button.dataset.filter)));
document.querySelectorAll('[data-category-link]').forEach((link) => {
  link.addEventListener('click', () => {
    setCategory(link.dataset.categoryLink);
    document.getElementById('main-nav').classList.remove('is-open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  });
});

// Both search boxes stay in sync and filter the sample products immediately.
function updateSearch(value, source) {
  searchTerm = value.trim();
  showingSaved = false;
  if (source !== 'header') document.getElementById('search-input').value = value;
  if (source !== 'shop') document.getElementById('shop-search-input').value = value;
  updateFilterUI();
  renderProducts();
}
document.getElementById('search-input').addEventListener('input', (event) => updateSearch(event.target.value, 'header'));
document.getElementById('shop-search-input').addEventListener('input', (event) => updateSearch(event.target.value, 'shop'));
document.getElementById('sort-select').addEventListener('change', (event) => { sortMode = event.target.value; renderProducts(); });
document.getElementById('saved-toggle').addEventListener('click', () => {
  showingSaved = !showingSaved;
  selectedCategory = 'all';
  searchTerm = '';
  document.getElementById('search-input').value = '';
  document.getElementById('shop-search-input').value = '';
  updateFilterUI();
  renderProducts();
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
});

// Shopping bag interactions are stored locally in this preview only.
document.getElementById('cart-open').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
drawerBackdrop.addEventListener('click', closeCart);
document.getElementById('empty-shop-button').addEventListener('click', () => {
  closeCart();
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('checkout-open').addEventListener('click', () => checkoutDialog.showModal());

// Delegate product actions so dynamic cards and dialog buttons work consistently.
document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add-product]');
  const save = event.target.closest('[data-save-product]');
  const detail = event.target.closest('[data-product-detail]');
  const cartAction = event.target.closest('[data-cart-action]');
  const reset = event.target.closest('[data-reset-filters]');
  const closeDialog = event.target.closest('[data-close-dialog]');

  if (add) {
    addToCart(add.dataset.addProduct);
    if (productDialog.open) productDialog.close();
    return;
  }
  if (save) {
    const id = save.dataset.saveProduct;
    toggleSaved(id);
    if (productDialog.open) openProductDialog(id);
    return;
  }
  if (detail) {
    openProductDialog(detail.dataset.productDetail);
    return;
  }
  if (cartAction) {
    const id = cartAction.dataset.productId;
    const action = cartAction.dataset.cartAction;
    if (action === 'plus') cart[id] = (Number(cart[id]) || 0) + 1;
    if (action === 'minus') cart[id] = (Number(cart[id]) || 0) - 1;
    if (action === 'remove' || Number(cart[id]) <= 0) delete cart[id];
    saveCart();
    renderCart();
    return;
  }
  if (reset) {
    sortMode = 'featured';
    document.getElementById('sort-select').value = 'featured';
    setCategory('all');
  }
  if (closeDialog) {
    const dialog = closeDialog.closest('dialog');
    if (dialog?.open) dialog.close();
  }
});

document.getElementById('menu-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const nav = document.getElementById('main-nav');
  const isOpen = nav.classList.toggle('is-open');
  button.setAttribute('aria-expanded', String(isOpen));
  button.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cartDrawer.classList.contains('is-open')) closeCart();
});

// Keep a sensible contact placeholder from implying a live support inbox.
document.querySelector('a[href="mailto:hello@markettech.in"]').addEventListener('click', (event) => {
  event.preventDefault();
  showToast('A real customer support contact will be added before launch.');
});

document.getElementById('current-year').textContent = new Date().getFullYear();
renderProducts();
renderCart();
updateFilterUI();
