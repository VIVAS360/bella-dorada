const DATA_URL = 'data/catalogo.json';

const fallbackData = {
  config: {
    topbar: 'Bella Dorada · ramos de maquillaje, detalles y regalos personalizados',
    heroEtiqueta: 'Catálogo especial',
    heroTitulo: 'Ramos de maquillaje Bella Dorada',
    heroDescripcion: 'Detalles únicos con maquillaje, flores, brochas, gloss, paletas y productos de cuidado personal. Catálogo dinámico cargado desde JSON.',
    heroImagen: 'https://sofi.pe/wp-content/uploads/2023/01/regalo-para-mujer-ramo-de-maquillaje-brochas-rostro-makeup-1-680x843.jpg',
    aboutTitulo: 'Regalos personalizados con estilo femenino y elegante',
    aboutTexto: 'Bella Dorada crea ramos y boxes de maquillaje pensados para cumpleaños, aniversarios, amor, amistad, Día de la Madre y fechas especiales. Cada referencia puede adaptarse según disponibilidad, colores y presupuesto.',
    footerDescripcion: 'Ramos de maquillaje, boxes de belleza y detalles personalizados para regalar.',
    email: 'Belladorada.oficial@gmail.com',
    whatsapp: '573185331331'
  },
  categorias: [
    { id: 'ramos-maquillaje', nombre: 'Ramos de maquillaje' },
    { id: 'ramos-premium', nombre: 'Ramos premium' },
    { id: 'box-belleza', nombre: 'Box de belleza' },
    { id: 'personalizados', nombre: 'Personalizados' },
    { id: 'mini-detalles', nombre: 'Mini detalles' }
  ],
  productos: []
};

const CART_STORAGE_KEY = 'bella_dorada_cart';

const state = {
  data: fallbackData,
  categoriaActiva: 'ramos_todos',
  busqueda: '',
  carrito: loadCart(),
  carritoMovilAbierto: false
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const elements = {
  topbar: $('#topbar'),
  menuToggle: $('[data-menu-toggle]'),
  nav: $('[data-nav]'),
  search: $('[data-search]'),
  clearFilters: $('[data-clear-filters]'),
  categoryFilters: $('#categoryFilters'),
  productosGrid: $('#productosGrid'),
  destacadosGrid: $('#destacadosGrid'),
  catalogCount: $('#catalogCount'),
  emptyState: $('#emptyState'),
  cardTemplate: $('#productCardTemplate'),
  totalProductosHero: $('#totalProductosHero'),

  cartPanel: $('[data-cart-panel]'),
  cartToggle: $('[data-cart-toggle]'),
  cartItems: $('[data-cart-items]'),
  cartEmpty: $('[data-cart-empty]'),
  cartTotal: $('[data-cart-total]'),
  cartTotalHead: $('[data-cart-total-head]'),
  cartCount: $('[data-cart-count]'),
  cartCountDesktop: $('[data-cart-count-desktop]'),
  cartCheckout: $('[data-cart-checkout]')
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function moneyOrText(value) {
  if (value === null || value === undefined || value === '') return 'Consultar';

  if (typeof value === 'number') {
    return formatCurrency(value);
  }

  const numberValue = parsePrice(value);
  const looksNumeric = /\d/.test(String(value));

  if (looksNumeric && numberValue > 0 && !String(value).includes('€')) {
    return formatCurrency(numberValue);
  }

  return value;
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value || '').trim();
  if (!raw) return 0;

  let text = raw.replace(/[^\d,.-]/g, '');

  if (!text) return 0;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = text.split('.');
    const lastPart = parts[parts.length - 1];

    if (lastPart.length === 3 && parts.length > 1) {
      text = text.replace(/\./g, '');
    }
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function loadCart() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('No se pudo cargar el carrito:', error.message);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.carrito));
}

function getCategoryName(categoryId) {
  const categoria = state.data.categorias.find((item) => item.id === categoryId);
  return categoria ? categoria.nombre : 'General';
}

function getProductById(productId) {
  return state.data.productos.find((producto) => String(producto.id) === String(productId));
}

function getProductStock(producto) {
  return Math.max(0, Number(producto?.stock ?? 0) || 0);
}

function getCartQuantityByProductId(productId) {
  const item = state.carrito.find((cartItem) => String(cartItem.id) === String(productId));
  return item ? Number(item.cantidad) || 0 : 0;
}

function canAddToCart(productId, showMessage = true) {
  const producto = getProductById(productId);

  if (!producto) {
    return false;
  }

  const stock = getProductStock(producto);
  const cantidadActual = getCartQuantityByProductId(productId);

  if (stock <= 0) {
    if (showMessage) {
      alert(`"${producto.nombre}" no tiene stock disponible.`);
    }

    return false;
  }

  if (cantidadActual >= stock) {
    if (showMessage) {
      alert(`No puedes agregar más unidades de "${producto.nombre}". Stock disponible: ${stock}.`);
    }

    return false;
  }

  return true;
}

function validateCartStock() {
  const { items } = getCartTotals();
  const errores = [];

  items.forEach((item) => {
    const stock = getProductStock(item.producto);

    if (stock <= 0) {
      errores.push(`- ${item.producto.nombre}: sin stock disponible.`);
      return;
    }

    if (item.cantidad > stock) {
      errores.push(`- ${item.producto.nombre}: tienes ${item.cantidad}, pero solo hay ${stock} disponibles.`);
    }
  });

  if (errores.length) {
    alert('No se puede enviar el pedido porque supera el stock disponible:\n\n' + errores.join('\n'));
    return false;
  }

  return true;
}

function sanitizeCartAgainstStock() {
  let changed = false;

  state.carrito = state.carrito
    .map((item) => {
      const producto = getProductById(item.id);

      if (!producto || producto.estado === false) {
        changed = true;
        return null;
      }

      const stock = getProductStock(producto);
      let cantidad = Number(item.cantidad) || 1;

      if (stock <= 0) {
        changed = true;
        return null;
      }

      if (cantidad > stock) {
        cantidad = stock;
        changed = true;
      }

      return {
        ...item,
        cantidad
      };
    })
    .filter(Boolean);

  if (changed) {
    saveCart();
  }
}

function getCartItemsWithProductData() {
  return state.carrito
    .map((item) => {
      const producto = getProductById(item.id);
      if (!producto || producto.estado === false) return null;

      const cantidad = Number(item.cantidad) || 1;
      const precioUnitario = parsePrice(producto.precio);

      return {
        id: producto.id,
        cantidad,
        producto,
        precioUnitario,
        subtotal: precioUnitario * cantidad
      };
    })
    .filter(Boolean);
}

function getCartTotals() {
  const items = getCartItemsWithProductData();

  return {
    items,
    cantidad: items.reduce((total, item) => total + item.cantidad, 0),
    total: items.reduce((total, item) => total + item.subtotal, 0)
  };
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar ${DATA_URL}`);
    const json = await response.json();

    state.data = {
      ...fallbackData,
      ...json,
      config: { ...fallbackData.config, ...(json.config || {}) },
      categorias: Array.isArray(json.categorias) ? json.categorias : fallbackData.categorias,
      productos: Array.isArray(json.productos) ? json.productos : fallbackData.productos
    };
  } catch (error) {
    console.warn('Usando datos de ejemplo:', error.message);
    state.data = fallbackData;
  }
}

function applyConfig() {
  const { config, productos } = state.data;

  if (elements.topbar) {
    elements.topbar.textContent = config.topbar || '';
  }

  const heroEtiqueta = $('#heroEtiqueta');
  if (heroEtiqueta) {
    heroEtiqueta.textContent = config.heroEtiqueta || '';
  }

  const heroTitulo = $('#heroTitulo');
  if (heroTitulo) {
    heroTitulo.textContent = config.heroTitulo || '';
  }

  const heroDescripcion = $('#heroDescripcion');
  if (heroDescripcion) {
    heroDescripcion.textContent = config.heroDescripcion || '';
  }

  const aboutTitulo = $('#aboutTitulo');
  if (aboutTitulo) {
    aboutTitulo.textContent = config.aboutTitulo || '';
  }

  const aboutTexto = $('#aboutTexto');
  if (aboutTexto) {
    aboutTexto.textContent = config.aboutTexto || '';
  }

  const footerDescripcion = $('#footerDescripcion');
  if (footerDescripcion) {
    footerDescripcion.textContent = config.footerDescripcion || '';
  }

  const emailLink = $('#emailLink');
  if (emailLink) {
    emailLink.textContent = config.email || '';
    emailLink.href = `mailto:${config.email || ''}`;
  }

  const whatsappLink = $('#whatsappLink');
    if (whatsappLink) {
      const whatsapp = String(config.whatsapp || '').replace(/\D/g, '');
      whatsappLink.href = whatsapp ? `https://wa.me/${whatsapp}` : '#';
    }

    const instagramLink = $('#instagramLink');
  if (instagramLink) {
    instagramLink.href = config.instagram || '#';
    instagramLink.hidden = !config.instagram;
  }

  const facebookLink = $('#facebookLink');
  if (facebookLink) {
    facebookLink.href = config.facebook || '#';
    facebookLink.hidden = !config.facebook;
  }

  const tiktokLink = $('#tiktokLink');
  if (tiktokLink) {
    tiktokLink.href = config.tiktok || '#';
    tiktokLink.hidden = !config.tiktok;
  }

  const activos = productos.filter((producto) => producto.estado !== false).length;

  if (elements.totalProductosHero) {
    elements.totalProductosHero.textContent = `${activos} ${activos === 1 ? 'producto' : 'productos'}`;
  }

  const heroImagen = $('#heroImagen');
  if (heroImagen && config.heroImagen) {
    heroImagen.style.backgroundImage = `linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.54)), url("${config.heroImagen}")`;
  }
}

function getProductType(producto) {
  return producto?.tipo_producto || 'ramos_full';
}

function getCategoryType(categoria) {
  return categoria?.tipo_categoria || categoria?.tipo || 'ramos';
}

function isRamoProduct(producto) {
  return getProductType(producto) === 'ramos_full';
}

function isIndividualProduct(producto) {
  return getProductType(producto) === 'individual';
}

function getIndividualCategories() {
  return state.data.categorias.filter((categoria) => {
    return getCategoryType(categoria) === 'individual' && categoria.estado !== false;
  });
}

function getRamosCategories() {
  return state.data.categorias.filter((categoria) => {
    return getCategoryType(categoria) === 'ramos' && categoria.estado !== false;
  });
}

function renderCategories() {
  if (!elements.categoryFilters) return;

  const fragment = document.createDocumentFragment();

  fragment.appendChild(
    createFilterButton('ramos_todos', 'Todos los ramos')
  );

  fragment.appendChild(
    createFilterButton('individual_todos', 'Productos de belleza')
  );

  getIndividualCategories().forEach((categoria) => {
    fragment.appendChild(
      createFilterButton(`individual_cat:${categoria.id}`, categoria.nombre)
    );
  });

  elements.categoryFilters.replaceChildren(fragment);
  updateActiveFilterUI();
}

function createFilterButton(id, label) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'filter-btn';
  button.dataset.category = id;
  button.textContent = label;

  button.addEventListener('click', () => {
    state.categoriaActiva = id;
    updateActiveFilterUI();
    renderProducts();
  });

  return button;
}

function updateActiveFilterUI() {
  if (!elements.categoryFilters) return;

  $$('.filter-btn', elements.categoryFilters).forEach((button) => {
    button.classList.toggle('is-active', button.dataset.category === state.categoriaActiva);
  });
}

function getVisibleProducts({ destacados = false } = {}) {
  const search = normalizeText(state.busqueda);
  const filtro = state.categoriaActiva || 'ramos_todos';

  return state.data.productos.filter((producto) => {
    if (producto.estado === false) return false;
    if (!isProductCategoryVisible(producto)) return false;

    if (destacados && !producto.destacado) {
      return false;
    }

    if (!destacados) {
      if (filtro === 'ramos_todos') {
        if (!isRamoProduct(producto)) return false;
      } else if (filtro === 'individual_todos') {
        if (!isIndividualProduct(producto)) return false;
      } else if (filtro.startsWith('individual_cat:')) {
        const categoriaId = filtro.replace('individual_cat:', '');

        if (!isIndividualProduct(producto)) return false;
        if (producto.categoria !== categoriaId) return false;
      }
    }

    if (!search) return true;

    const searchable = normalizeText([
      producto.nombre,
      producto.descripcion,
      producto.codigo,
      getCategoryName(producto.categoria),
      getProductType(producto),
      ...(producto.tags || [])
    ].join(' '));

    return searchable.includes(search);
  });
}

function createProductCard(producto) {
  const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);

  $('.product-category', node).textContent = getCategoryName(producto.categoria);
  $('.product-code', node).textContent = producto.codigo || '';
  $('.product-title', node).textContent = producto.nombre || '';
  $('.product-description', node).textContent = producto.descripcion || '';
  $('.product-price', node).textContent = moneyOrText(producto.precio);

  const media = $('.product-media', node);

  if (producto.imagen) {
    media.style.backgroundImage = `linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.28)), url("${producto.imagen}")`;
    media.classList.add('has-zoom');
    media.setAttribute('role', 'button');
    media.setAttribute('tabindex', '0');
    media.setAttribute('aria-label', `Ver imagen ampliada de ${producto.nombre}`);

    media.addEventListener('click', () => {
      openImageLightbox(producto.imagen, producto.nombre);
    });

    media.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openImageLightbox(producto.imagen, producto.nombre);
      }
    });
  }

  const button = $('.product-link', node);
  const stock = getProductStock(producto);
  const cantidadCarrito = getCartQuantityByProductId(producto.id);

  button.dataset.addCart = String(producto.id);

  if (stock <= 0) {
    button.textContent = 'Agotado';
    button.disabled = true;
    button.classList.add('is-disabled');
  } else if (cantidadCarrito >= stock) {
    button.textContent = 'Stock máximo';
    button.disabled = true;
    button.classList.add('is-disabled');
  } else if (cantidadCarrito > 0) {
    button.textContent = 'Agregar otro';
    button.disabled = false;
    button.classList.remove('is-disabled');
  } else {
    button.textContent = 'Agregar';
    button.disabled = false;
    button.classList.remove('is-disabled');
  }

  button.addEventListener('click', () => addToCart(producto.id));

  return node;
}

function renderProducts() {
  if (!elements.productosGrid) return;

  const products = getVisibleProducts();
  const fragment = document.createDocumentFragment();

  products.forEach((producto) => {
    fragment.appendChild(createProductCard(producto));
  });

  elements.productosGrid.replaceChildren(fragment);

  if (elements.catalogCount) {
    elements.catalogCount.textContent = `${products.length} ${products.length === 1 ? 'resultado' : 'resultados'}`;
  }

  if (elements.emptyState) {
    elements.emptyState.hidden = products.length > 0;
  }
}

function renderFeatured() {
  if (!elements.destacadosGrid) return;

  const products = getVisibleProducts({ destacados: true }).slice(0, 8);
  const fragment = document.createDocumentFragment();

  products.forEach((producto) => {
    fragment.appendChild(createProductCard(producto));
  });

  elements.destacadosGrid.replaceChildren(fragment);
}

function addToCart(productId) {
  const producto = getProductById(productId);

  if (!producto) {
    return;
  }

  if (!canAddToCart(productId)) {
    return;
  }

  const existing = state.carrito.find((item) => String(item.id) === String(productId));

  if (existing) {
    existing.cantidad += 1;
  } else {
    state.carrito.push({
      id: producto.id,
      cantidad: 1
    });
  }

  state.carritoMovilAbierto = true;

  saveCart();
  renderCart();
  renderProducts();
  renderFeatured();
}

function incrementCartItem(productId) {
  const item = state.carrito.find((cartItem) => String(cartItem.id) === String(productId));

  if (!item) {
    return;
  }

  if (!canAddToCart(productId)) {
    return;
  }

  item.cantidad += 1;

  saveCart();
  renderCart();
  renderProducts();
  renderFeatured();
}

function decrementCartItem(productId) {
  const item = state.carrito.find((cartItem) => String(cartItem.id) === String(productId));
  if (!item) return;

  item.cantidad -= 1;

  if (item.cantidad <= 0) {
    removeCartItem(productId);
    return;
  }

  saveCart();
  renderCart();
  renderProducts();
  renderFeatured();
}

function removeCartItem(productId) {
  state.carrito = state.carrito.filter((item) => String(item.id) !== String(productId));
  saveCart();
  renderCart();
  renderProducts();
  renderFeatured();
}

function setTextAll(selector, value) {
  $$(selector).forEach((element) => {
    element.textContent = value;
  });
}

function renderCart() {
  sanitizeCartAgainstStock();

  const { items, cantidad, total } = getCartTotals();
  const fragment = document.createDocumentFragment();

  setTextAll('[data-cart-count]', cantidad);
  setTextAll('[data-cart-count-desktop]', cantidad);
  setTextAll('[data-cart-total]', formatCurrency(total));
  setTextAll('[data-cart-total-head]', formatCurrency(total));

  if (elements.cartEmpty) {
    elements.cartEmpty.hidden = items.length > 0;
  }

  if (elements.cartPanel) {
    elements.cartPanel.classList.toggle('has-items', items.length > 0);

    const mobileCartExpanded = state.carritoMovilAbierto && items.length > 0;

    elements.cartPanel.classList.toggle('is-mobile-expanded', mobileCartExpanded);
    document.body.classList.toggle('cart-mobile-expanded', mobileCartExpanded);
  }

  items.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'cart-item';

    const stock = getProductStock(item.producto);
    const maxReached = item.cantidad >= stock;

    row.innerHTML = `
      <div class="cart-item-media" style="background-image: url('${item.producto.imagen || ''}')"></div>

      <div class="cart-item-info">
        <div class="cart-item-top">
          <strong title="${item.producto.nombre}">${item.producto.nombre}</strong>
          <button type="button" class="cart-remove" data-cart-remove="${item.producto.id}" aria-label="Eliminar producto">×</button>
        </div>

        <small class="cart-item-stock">Stock disponible: ${stock}</small>

        <div class="cart-item-controls">
          <button type="button" data-cart-minus="${item.producto.id}" aria-label="Restar unidad">−</button>
          <span>${item.cantidad}</span>
          <button
            type="button"
            data-cart-plus="${item.producto.id}"
            aria-label="Sumar unidad"
            ${maxReached ? 'disabled' : ''}
          >
            +
          </button>
        </div>

        <strong class="cart-item-subtotal">${formatCurrency(item.subtotal)}</strong>
      </div>
    `;

    fragment.appendChild(row);
  });

  if (elements.cartItems) {
    elements.cartItems.replaceChildren(fragment);
  }
}

function toggleMobileCart() {
  const { items } = getCartTotals();
  if (!items.length) return;

  state.carritoMovilAbierto = !state.carritoMovilAbierto;
  renderCart();
}

function buildOrderPayload() {
  const { items, total } = getCartTotals();

  return {
    origen: 'web-whatsapp',
    cliente: {
      nombre: 'Cliente WhatsApp',
      telefono: '',
      nota: ''
    },
    items: items.map((item) => ({
      producto_id: item.producto.id,
      codigo: item.producto.codigo || '',
      nombre: item.producto.nombre || '',
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      subtotal: item.subtotal
    })),
    total
  };
}

async function saveOrderBeforeWhatsApp() {
  try {
    const response = await fetch('admin/api.php?action=crear_pedido', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildOrderPayload())
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.warn('No se pudo registrar el pedido:', data.message || 'Error desconocido');
      return null;
    }

    return data.pedido_id || null;
  } catch (error) {
    console.warn('No se pudo conectar con el administrador:', error.message);
    return null;
  }
}

function buildWhatsAppMessage(pedidoId = null) {
  const { items, total } = getCartTotals();

  const lines = [
    'Hola Bella Dorada, quiero realizar este pedido:',
    ''
  ];

  if (pedidoId) {
    lines.push(`Pedido web: ${pedidoId}`);
    lines.push('');
  }

  lines.push('Resumen de compra:');

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.producto.nombre}`);
    if (item.producto.codigo) lines.push(`   Código: ${item.producto.codigo}`);
    lines.push(`   Cantidad: ${item.cantidad}`);
    lines.push(`   Precio unitario: ${moneyOrText(item.producto.precio)}`);
    lines.push(`   Subtotal: ${formatCurrency(item.subtotal)}`);
    lines.push('');
  });

  lines.push(`Total aproximado: ${formatCurrency(total)}`);
  lines.push('');
  lines.push('Quedo pendiente para confirmar disponibilidad, entrega y forma de pago.');

  return lines.join('\n');
}

async function checkoutWhatsApp() {
  sanitizeCartAgainstStock();

  const { items } = getCartTotals();

  if (!items.length) {
    alert('Tu carrito está vacío. Agrega al menos un producto antes de enviar el pedido.');
    return;
  }

  if (!validateCartStock()) {
    renderCart();
    renderProducts();
    renderFeatured();
    return;
  }

  const whatsapp = state.data?.config?.whatsapp
    ? String(state.data.config.whatsapp).replace(/\D/g, '')
    : '';

  if (!whatsapp) {
    alert('No hay un número de WhatsApp configurado en data/catalogo.json');
    return;
  }

  const pedidoId = await saveOrderBeforeWhatsApp();
  const message = encodeURIComponent(buildWhatsAppMessage(pedidoId));
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${message}`;

  const newWindow = window.open(whatsappUrl, '_blank');

  if (!newWindow) {
    window.location.href = whatsappUrl;
  }
}

function bindEvents() {
  if (elements.menuToggle && elements.nav) {
    elements.menuToggle.addEventListener('click', () => {
      const isOpen = elements.nav.classList.toggle('is-open');

      elements.menuToggle.classList.toggle('is-active', isOpen);
      elements.menuToggle.setAttribute('aria-expanded', String(isOpen));
      document.body.classList.toggle('menu-open', isOpen);
    });
  }

  $$('.nav a').forEach((link) => {
    link.addEventListener('click', () => {
      if (elements.nav) {
        elements.nav.classList.remove('is-open');
      }

      if (elements.menuToggle) {
        elements.menuToggle.classList.remove('is-active');
        elements.menuToggle.setAttribute('aria-expanded', 'false');
      }

      document.body.classList.remove('menu-open');
    });
  });

  if (elements.search) {
    elements.search.addEventListener('input', (event) => {
      state.busqueda = event.target.value;
      renderProducts();
    });
  }

  if (elements.clearFilters) {
    elements.clearFilters.addEventListener('click', () => {
      state.categoriaActiva = 'todos';
      state.busqueda = '';

      if (elements.search) {
        elements.search.value = '';
      }

      updateActiveFilterUI();
      renderProducts();
    });
  }

  if (elements.cartToggle) {
    elements.cartToggle.addEventListener('click', toggleMobileCart);
  }

  document.addEventListener('click', (event) => {
    const checkoutButton = event.target.closest('[data-cart-checkout]');

    if (checkoutButton) {
      event.preventDefault();
      event.stopPropagation();
      checkoutWhatsApp();
      return;
    }

    const plusButton = event.target.closest('[data-cart-plus]');
    if (plusButton) {
      event.preventDefault();
      incrementCartItem(plusButton.dataset.cartPlus);
      return;
    }

    const minusButton = event.target.closest('[data-cart-minus]');
    if (minusButton) {
      event.preventDefault();
      decrementCartItem(minusButton.dataset.cartMinus);
      return;
    }

    const removeButton = event.target.closest('[data-cart-remove]');
    if (removeButton) {
      event.preventDefault();
      removeCartItem(removeButton.dataset.cartRemove);
    }
  });
}

function openImageLightbox(imageUrl, title = '') {
  const modal = document.querySelector('[data-image-lightbox]');
  const img = document.querySelector('[data-image-lightbox-img]');
  const titleElement = document.querySelector('[data-image-lightbox-title]');

  if (!modal || !img) return;
  if (!imageUrl) return;

  img.src = imageUrl;
  img.alt = title || 'Imagen del producto';

  if (titleElement) {
    titleElement.textContent = title || '';
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('image-lightbox-open');
}

function closeImageLightbox() {
  const modal = document.querySelector('[data-image-lightbox]');
  const img = document.querySelector('[data-image-lightbox-img]');

  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('image-lightbox-open');

  setTimeout(() => {
    if (img && !modal.classList.contains('is-open')) {
      img.src = '';
    }
  }, 220);
}

function bindImageLightboxEvents() {
  const modal = document.querySelector('[data-image-lightbox]');
  const closeButton = document.querySelector('[data-image-lightbox-close]');

  if (closeButton) {
    closeButton.addEventListener('click', closeImageLightbox);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeImageLightbox();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeImageLightbox();
    }
  });
}

const BUILDER_TYPES_URL = 'data/presentaciones.json';

const fallbackBouquetBuilderTypes = [
  {
    id: 'ramo_full',
    icon: '💐',
    nombre: 'Ramo full',
    descripcion: 'Grande, llamativo y perfecto para regalo especial.',
    precioBase: 25000,
    orden: 1,
    estado: true
  },
  {
    id: 'ramo_mini',
    icon: '🌸',
    nombre: 'Ramo mini',
    descripcion: 'Detalle pequeño, bonito y económico.',
    precioBase: 15000,
    orden: 2,
    estado: true
  },
  {
    id: 'box_belleza',
    icon: '🎁',
    nombre: 'Box sorpresa',
    descripcion: 'Caja de regalo con productos seleccionados.',
    precioBase: 20000,
    orden: 3,
    estado: true
  },
  {
    id: 'pocillo',
    icon: '☕',
    nombre: 'Pocillo decorado',
    descripcion: 'Pocillo con maquillaje, dulces o accesorios.',
    precioBase: 18000,
    orden: 4,
    estado: true
  },
  {
    id: 'canasta',
    icon: '🧺',
    nombre: 'Canasta premium',
    descripcion: 'Presentación elegante con más espacio para detalles.',
    precioBase: 30000,
    orden: 5,
    estado: true
  }
];

let bouquetBuilderTypes = [...fallbackBouquetBuilderTypes];

async function loadBuilderTypes() {
  try {
    const response = await fetch(BUILDER_TYPES_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`No se pudo cargar ${BUILDER_TYPES_URL}`);
    }

    const json = await response.json();

    const rawItems = Array.isArray(json)
      ? json
      : Array.isArray(json.presentaciones)
        ? json.presentaciones
        : [];

    const normalized = rawItems
      .filter((item) => item && item.estado !== false)
      .map((item, index) => ({
        id: String(item.id || `presentacion_${index + 1}`),
        icon: item.icon || '💐',
        nombre: item.nombre || 'Presentación personalizada',
        descripcion: item.descripcion || '',
        precioBase: parsePrice(item.precioBase ?? item.precio_base ?? 0),
        orden: Number(item.orden ?? index + 1),
        estado: item.estado !== false
      }))
      .sort((a, b) => a.orden - b.orden);

    bouquetBuilderTypes = normalized.length ? normalized : [...fallbackBouquetBuilderTypes];

    if (!bouquetBuilderTypes.some((type) => type.id === bouquetBuilderState.tipo)) {
      bouquetBuilderState.tipo = bouquetBuilderTypes[0]?.id || 'ramo_full';
    }
  } catch (error) {
    console.warn('Usando presentaciones de ejemplo:', error.message);
    bouquetBuilderTypes = [...fallbackBouquetBuilderTypes];

    if (!bouquetBuilderTypes.some((type) => type.id === bouquetBuilderState.tipo)) {
      bouquetBuilderState.tipo = bouquetBuilderTypes[0]?.id || 'ramo_full';
    }
  }
}

const bouquetBuilderState = {
  abierto: false,
  tipo: 'ramo_full',
  categoria: 'todos',
  busqueda: '',
  items: {}
};

function getBuilderElements() {
  return {
    modal: $('[data-builder-modal]'),
    openButtons: $$('[data-builder-open]'),
    closeButtons: $$('[data-builder-close]'),
    types: $('[data-builder-types]'),
    categories: $('[data-builder-categories]'),
    products: $('[data-builder-products]'),
    search: $('[data-builder-search]'),
    stage: $('[data-builder-stage]'),
    selectedList: $('[data-builder-selected-list]'),
    total: $('[data-builder-total]'),
    footerTotal: $('[data-builder-footer-total]'),
    typeName: $('[data-builder-type-name]'),
    send: $('[data-builder-send]')
  };
}

function getBuilderType() {
  if (!bouquetBuilderTypes.length) {
    bouquetBuilderTypes = [...fallbackBouquetBuilderTypes];
  }

  let selected = bouquetBuilderTypes.find((item) => item.id === bouquetBuilderState.tipo);

  if (!selected) {
    selected = bouquetBuilderTypes[0];
    bouquetBuilderState.tipo = selected.id;
  }

  return selected;
}

function getIndividualProductsForBuilder() {
  const productos = Array.isArray(state.data?.productos) ? state.data.productos : [];

  return productos.filter((producto) => {
    return producto.estado !== false
      && isIndividualProduct(producto)
      && isProductCategoryVisible(producto);
  });
}

function getFilteredBuilderProducts() {
  const search = normalizeText(bouquetBuilderState.busqueda);

  return getIndividualProductsForBuilder().filter((producto) => {
    if (bouquetBuilderState.categoria !== 'todos' && producto.categoria !== bouquetBuilderState.categoria) {
      return false;
    }

    if (!search) return true;

    const searchable = normalizeText([
      producto.nombre,
      producto.codigo,
      producto.descripcion,
      getCategoryName(producto.categoria),
      ...(producto.tags || [])
    ].join(' '));

    return searchable.includes(search);
  });
}

function getBuilderItemQuantity(productId) {
  return Number(bouquetBuilderState.items[String(productId)] || 0);
}

function getBuilderItems() {
  return Object.entries(bouquetBuilderState.items)
    .map(([productId, cantidad]) => {
      const producto = getProductById(productId);

      if (!producto || producto.estado === false) {
        return null;
      }

      const cantidadNumber = Number(cantidad) || 0;

      if (cantidadNumber <= 0) {
        return null;
      }

      const precio = parsePrice(producto.precio);

      return {
        producto,
        cantidad: cantidadNumber,
        precio,
        subtotal: precio * cantidadNumber
      };
    })
    .filter(Boolean);
}

function getBuilderTotals() {
  const type = getBuilderType();
  const items = getBuilderItems();

  const productosTotal = items.reduce((total, item) => total + item.subtotal, 0);
  const base = Number(type.precioBase) || 0;

  return {
    type,
    items,
    base,
    productosTotal,
    total: base + productosTotal,
    cantidad: items.reduce((total, item) => total + item.cantidad, 0)
  };
}

function openBouquetBuilder() {
  const els = getBuilderElements();

  bouquetBuilderState.abierto = true;

  if (els.modal) {
    els.modal.classList.add('is-open');
    els.modal.setAttribute('aria-hidden', 'false');
  }

  document.body.classList.add('builder-open');
  renderBouquetBuilder();
}

function closeBouquetBuilder() {
  const els = getBuilderElements();

  bouquetBuilderState.abierto = false;

  if (els.modal) {
    els.modal.classList.remove('is-open');
    els.modal.setAttribute('aria-hidden', 'true');
  }

  document.body.classList.remove('builder-open');
}

function selectBuilderType(typeId) {
  bouquetBuilderState.tipo = typeId;
  renderBouquetBuilder();
}

function addBuilderProduct(productId) {
  const producto = getProductById(productId);

  if (!producto) return;

  const stock = getProductStock(producto);
  const actual = getBuilderItemQuantity(productId);

  if (stock <= 0) {
    alert(`"${producto.nombre}" no tiene stock disponible.`);
    return;
  }

  if (actual >= stock) {
    alert(`No puedes agregar más unidades de "${producto.nombre}". Stock disponible: ${stock}.`);
    return;
  }

  bouquetBuilderState.items[String(productId)] = actual + 1;
  renderBouquetBuilder();
}

function decrementBuilderProduct(productId) {
  const actual = getBuilderItemQuantity(productId);

  if (actual <= 1) {
    delete bouquetBuilderState.items[String(productId)];
  } else {
    bouquetBuilderState.items[String(productId)] = actual - 1;
  }

  renderBouquetBuilder();
}

function removeBuilderProduct(productId) {
  delete bouquetBuilderState.items[String(productId)];
  renderBouquetBuilder();
}

function renderBuilderTypes() {
  const els = getBuilderElements();
  if (!els.types) return;

  const fragment = document.createDocumentFragment();

  bouquetBuilderTypes.forEach((type) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `builder-type-card ${bouquetBuilderState.tipo === type.id ? 'is-active' : ''}`;
    button.dataset.builderType = type.id;

    button.innerHTML = `
      <span>${type.icon}</span>
      <strong>${type.nombre}</strong>
      <small>${type.descripcion}</small>
      <small>${formatCurrency(type.precioBase)}</small>
    `;

    fragment.appendChild(button);
  });

  els.types.replaceChildren(fragment);
}

function getCategoryById(categoryId) {
  return state.data.categorias.find((categoria) => String(categoria.id) === String(categoryId));
}

function isCategoryVisible(categoryId) {
  const categoria = getCategoryById(categoryId);

  if (!categoria) {
    return true;
  }

  return categoria.estado !== false;
}

function isProductCategoryVisible(producto) {
  return isCategoryVisible(producto?.categoria);
}

function renderBuilderCategories() {
  const els = getBuilderElements();
  if (!els.categories) return;

  const productos = getIndividualProductsForBuilder();

  const categoryIds = [
    ...new Set(
      productos
        .map((producto) => producto.categoria)
        .filter(Boolean)
    )
  ];

  const fragment = document.createDocumentFragment();

  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = `builder-category-btn ${bouquetBuilderState.categoria === 'todos' ? 'is-active' : ''}`;
  allButton.dataset.builderCategory = 'todos';
  allButton.textContent = 'Todos';
  fragment.appendChild(allButton);

  categoryIds.forEach((categoryId) => {
    const categoria = state.data.categorias.find((item) => item.id === categoryId);

    if (!categoria || getCategoryType(categoria) !== 'individual') {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `builder-category-btn ${bouquetBuilderState.categoria === categoryId ? 'is-active' : ''}`;
    button.dataset.builderCategory = categoryId;
    button.textContent = categoria.nombre;
    fragment.appendChild(button);
  });

  els.categories.replaceChildren(fragment);
}

function renderBuilderProducts() {
  const els = getBuilderElements();
  if (!els.products) return;

  const productos = getFilteredBuilderProducts();
  const fragment = document.createDocumentFragment();

  if (!productos.length) {
    const empty = document.createElement('div');
    empty.className = 'builder-empty-products';
    empty.innerHTML = `
      <strong>No hay productos individuales disponibles.</strong>
      <p>Crea productos desde el admin en “Productos individuales” para que aparezcan aquí.</p>
    `;
    fragment.appendChild(empty);
    els.products.replaceChildren(fragment);
    return;
  }

  productos.forEach((producto) => {
    const stock = getProductStock(producto);
    const selected = getBuilderItemQuantity(producto.id);
    const disabled = stock <= 0 || selected >= stock;

    const card = document.createElement('article');
    card.className = 'builder-product-card';

    card.innerHTML = `
      <div class="builder-product-img" style="background-image:url('${producto.imagen || ''}')"></div>

      <div class="builder-product-info">
        <strong title="${producto.nombre || ''}">${producto.nombre || ''}</strong>
        <small>${producto.codigo || ''} · Stock: ${stock}</small>
        <span class="builder-product-price">${moneyOrText(producto.precio)}</span>

        <div class="builder-product-actions">
          <button type="button" data-builder-add="${producto.id}" ${disabled ? 'disabled' : ''}>
            ${selected > 0 ? 'Agregar otro' : 'Agregar'}
          </button>
          ${selected > 0 ? `<small>Elegidos: ${selected}</small>` : ''}
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  els.products.replaceChildren(fragment);
}

function renderBuilderStage() {
  const els = getBuilderElements();
  if (!els.stage) return;

  const { type, items, cantidad } = getBuilderTotals();

  const stageGlow = document.createElement('div');
  stageGlow.className = 'builder-stage-glow';

  const baseLabel = document.createElement('div');
  baseLabel.className = 'builder-base-label';
  baseLabel.innerHTML = `<span>${type.icon}</span> ${type.nombre}`;

  const fragment = document.createDocumentFragment();
  fragment.appendChild(stageGlow);

  if (!cantidad) {
    const empty = document.createElement('div');
    empty.className = 'builder-empty-stage';
    empty.innerHTML = `
      <span>${type.icon}</span>
      <p>Selecciona productos para construir tu ${type.nombre.toLowerCase()}</p>
    `;
    fragment.appendChild(empty);
    fragment.appendChild(baseLabel);
    els.stage.replaceChildren(fragment);
    return;
  }

  const pieces = [];

  items.forEach((item) => {
    const maxPieces = Math.min(item.cantidad, 3);

    for (let index = 0; index < maxPieces; index += 1) {
      pieces.push(item);
    }
  });

  pieces.slice(0, 7).forEach((item) => {
    const piece = document.createElement('div');
    piece.className = 'builder-piece';
    piece.innerHTML = `<img src="${item.producto.imagen || ''}" alt="${item.producto.nombre || ''}">`;
    fragment.appendChild(piece);
  });

  fragment.appendChild(baseLabel);
  els.stage.replaceChildren(fragment);
}

function renderBuilderSelectedList() {
  const els = getBuilderElements();
  if (!els.selectedList) return;

  const { items } = getBuilderTotals();
  const fragment = document.createDocumentFragment();

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'builder-empty-products';
    empty.innerHTML = '<p>Aún no has seleccionado productos.</p>';
    fragment.appendChild(empty);
    els.selectedList.replaceChildren(fragment);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'builder-selected-row';

    row.innerHTML = `
      <img src="${item.producto.imagen || ''}" alt="${item.producto.nombre || ''}">

      <div>
        <strong>${item.producto.nombre || ''}</strong>
        <small>${item.cantidad} x ${moneyOrText(item.producto.precio)} = ${formatCurrency(item.subtotal)}</small>
      </div>

      <div class="builder-selected-controls">
        <button type="button" data-builder-minus="${item.producto.id}">−</button>
        <span>${item.cantidad}</span>
        <button type="button" data-builder-add="${item.producto.id}">+</button>
        <button type="button" data-builder-remove="${item.producto.id}">×</button>
      </div>
    `;

    fragment.appendChild(row);
  });

  els.selectedList.replaceChildren(fragment);
}

function renderBouquetBuilder() {
  const els = getBuilderElements();
  const { type, total } = getBuilderTotals();

  if (els.typeName) {
    els.typeName.textContent = type.nombre;
  }

  if (els.total) {
    els.total.textContent = formatCurrency(total);
  }

  if (els.footerTotal) {
    els.footerTotal.textContent = formatCurrency(total);
  }

  renderBuilderTypes();
  renderBuilderCategories();
  renderBuilderProducts();
  renderBuilderStage();
  renderBuilderSelectedList();
}

function buildCustomBouquetWhatsAppMessage() {
  const { type, items, base, total } = getBuilderTotals();

  const lines = [
    'Hola Bella Dorada, quiero crear un ramo personalizado:',
    '',
    `Tipo de presentación: ${type.nombre}`,
    `Valor base de presentación: ${formatCurrency(base)}`,
    '',
    'Productos seleccionados:'
  ];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.producto.nombre}`);
    if (item.producto.codigo) lines.push(`   Código: ${item.producto.codigo}`);
    lines.push(`   Cantidad: ${item.cantidad}`);
    lines.push(`   Precio unitario: ${moneyOrText(item.producto.precio)}`);
    lines.push(`   Subtotal: ${formatCurrency(item.subtotal)}`);
    lines.push('');
  });

  lines.push(`Total aproximado: ${formatCurrency(total)}`);
  lines.push('');
  lines.push('Quedo pendiente para confirmar disponibilidad, colores, empaque y forma de pago.');

  return lines.join('\n');
}

function validateBuilderStock() {
  const { items } = getBuilderTotals();
  const errors = [];

  items.forEach((item) => {
    const stock = getProductStock(item.producto);

    if (item.cantidad > stock) {
      errors.push(`- ${item.producto.nombre}: elegiste ${item.cantidad}, pero solo hay ${stock}.`);
    }
  });

  if (errors.length) {
    alert('Hay productos que superan el stock disponible:\n\n' + errors.join('\n'));
    return false;
  }

  return true;
}

function sendCustomBouquetToWhatsApp() {
  const { items } = getBuilderTotals();

  if (!items.length) {
    alert('Selecciona al menos un producto para armar tu ramo personalizado.');
    return;
  }

  if (!validateBuilderStock()) {
    return;
  }

  const whatsapp = state.data?.config?.whatsapp
    ? String(state.data.config.whatsapp).replace(/\D/g, '')
    : '';

  if (!whatsapp) {
    alert('No hay un número de WhatsApp configurado en data/catalogo.json');
    return;
  }

  const message = encodeURIComponent(buildCustomBouquetWhatsAppMessage());
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${message}`;

  const newWindow = window.open(whatsappUrl, '_blank');

  if (!newWindow) {
    window.location.href = whatsappUrl;
  }
}

function bindBouquetBuilder() {
  const els = getBuilderElements();

  els.openButtons.forEach((button) => {
    button.addEventListener('click', openBouquetBuilder);
  });

  els.closeButtons.forEach((button) => {
    button.addEventListener('click', closeBouquetBuilder);
  });

  if (els.modal) {
    els.modal.addEventListener('click', (event) => {
      if (event.target === els.modal) {
        closeBouquetBuilder();
      }
    });
  }

  if (els.search) {
    els.search.addEventListener('input', (event) => {
      bouquetBuilderState.busqueda = event.target.value;
      renderBuilderProducts();
    });
  }

  if (els.send) {
    els.send.addEventListener('click', sendCustomBouquetToWhatsApp);
  }

  document.addEventListener('click', (event) => {
    const typeButton = event.target.closest('[data-builder-type]');
    if (typeButton) {
      selectBuilderType(typeButton.dataset.builderType);
      return;
    }

    const categoryButton = event.target.closest('[data-builder-category]');
    if (categoryButton) {
      bouquetBuilderState.categoria = categoryButton.dataset.builderCategory;
      renderBouquetBuilder();
      return;
    }

    const addButton = event.target.closest('[data-builder-add]');
    if (addButton) {
      addBuilderProduct(addButton.dataset.builderAdd);
      return;
    }

    const minusButton = event.target.closest('[data-builder-minus]');
    if (minusButton) {
      decrementBuilderProduct(minusButton.dataset.builderMinus);
      return;
    }

    const removeButton = event.target.closest('[data-builder-remove]');
    if (removeButton) {
      removeBuilderProduct(removeButton.dataset.builderRemove);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && bouquetBuilderState.abierto) {
      closeBouquetBuilder();
    }
  });
}

async function init() {
  await loadData();
  await loadBuilderTypes();

  sanitizeCartAgainstStock();

  applyConfig();
  renderCategories();
  renderFeatured();
  renderProducts();
  renderCart();
  bindEvents();
  bindImageLightboxEvents();
  bindBouquetBuilder();
}

init();
