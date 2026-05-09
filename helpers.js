const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const BD_DATA_DIR = path.join(__dirname, 'data');
const BD_CATALOGO_FILE = path.join(BD_DATA_DIR, 'catalogo.json');
const BD_USUARIOS_FILE = path.join(BD_DATA_DIR, 'usuarios.json');
const BD_PEDIDOS_FILE = path.join(BD_DATA_DIR, 'pedidos.json');
const BD_COMPRAS_FILE = path.join(BD_DATA_DIR, 'compras.json');
const BD_ROLES_FILE = path.join(BD_DATA_DIR, 'roles.json');
const BD_PRESENTACIONES_FILE = path.join(BD_DATA_DIR, 'presentaciones.json');

function bd_ensure_data_files() {
    if (!fs.existsSync(BD_DATA_DIR)) {
        fs.mkdirSync(BD_DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(BD_USUARIOS_FILE) || bd_read_json(BD_USUARIOS_FILE, []).length === 0) {
        bd_write_json(BD_USUARIOS_FILE, [
            {
                id: 1,
                nombre: 'Administrador Bella Dorada',
                usuario: 'admin',
                email: 'admin@belladorada.com',
                password: bcrypt.hashSync('admin123', 10),
                rol: 'admin',
                estado: true,
                created_at: new Date().toISOString(),
            },
        ]);
    }

    if (!fs.existsSync(BD_PEDIDOS_FILE)) {
        bd_write_json(BD_PEDIDOS_FILE, []);
    }

    if (!fs.existsSync(BD_COMPRAS_FILE)) {
        bd_write_json(BD_COMPRAS_FILE, []);
    }

    if (!fs.existsSync(BD_PRESENTACIONES_FILE)) {
        bd_write_json(BD_PRESENTACIONES_FILE, { presentaciones: bd_presentaciones_default() });
    }

    if (!fs.existsSync(BD_ROLES_FILE) || bd_read_json(BD_ROLES_FILE, []).length === 0) {
        bd_write_json(BD_ROLES_FILE, [
            { id: 'admin', nombre: 'Administrador', permisos: ['dashboard', 'productos', 'pedidos', 'compras', 'usuarios', 'roles'] },
            { id: 'ventas', nombre: 'Ventas', permisos: ['dashboard', 'pedidos', 'ventas'] },
            { id: 'inventario', nombre: 'Inventario', permisos: ['dashboard', 'productos', 'compras'] },
        ]);
    }

    if (!fs.existsSync(BD_CATALOGO_FILE)) {
        bd_write_json(BD_CATALOGO_FILE, {
            config: {
                topbar: 'Bella Dorada · ramos de maquillaje, detalles y regalos personalizados',
                heroEtiqueta: 'Catálogo especial',
                heroTitulo: 'Ramos de maquillaje Bella Dorada',
                heroDescripcion: 'Detalles únicos con maquillaje, flores, brochas, gloss, paletas y productos de cuidado personal.',
                heroImagen: '',
                aboutTitulo: 'Regalos personalizados con estilo femenino y elegante',
                aboutTexto: 'Bella Dorada crea ramos y boxes de maquillaje para fechas especiales.',
                footerDescripcion: 'Ramos de maquillaje, boxes de belleza y detalles personalizados para regalar.',
                email: 'Belladorada.oficial@gmail.com',
                whatsapp: '573185331331',
            },
            categorias: [
                { id: 'ramos-maquillaje', nombre: 'Ramos de maquillaje' },
                { id: 'ramos-premium', nombre: 'Ramos premium' },
                { id: 'box-belleza', nombre: 'Box de belleza' },
            ],
            productos: [],
        });
    }
}

function bd_read_json(file, defaultValue = []) {
    if (!fs.existsSync(file)) {
        return defaultValue;
    }
    try {
        const content = fs.readFileSync(file, 'utf8');
        return JSON.parse(content) || defaultValue;
    } catch {
        return defaultValue;
    }
}

function bd_write_json(file, data) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
        return true;
    } catch {
        return false;
    }
}

function bd_h(value) {
    return value ? value.toString().replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}

function bd_current_user(req) {
    // Try session first (for local development)
    if (req.session && req.session.bd_user) {
        return req.session.bd_user;
    }
    
    // Try cookie (for production/serverless)
    if (req.cookies && req.cookies.user_id) {
        const usuarios = bd_read_json(BD_USUARIOS_FILE, []);
        const user = usuarios.find(u => String(u.id) === String(req.cookies.user_id));
        if (user) {
            // Cache in session if available
            if (req.session) req.session.bd_user = user;
            return user;
        }
    }
    
    return null;
}

function bd_require_login(req, res) {
    if (!bd_current_user(req)) {
        res.redirect('/admin');
        return false;
    }
    return true;
}

function bd_flash(req, message = null, type = 'success') {
    if (message !== null) {
        req.session.bd_flash = { message, type };
        return null;
    }
    const flash = req.session.bd_flash;
    delete req.session.bd_flash;
    return flash;
}

function bd_catalogo() {
    const catalogo = bd_read_json(BD_CATALOGO_FILE, {});
    catalogo.config = catalogo.config || {};
    catalogo.categorias = Array.isArray(catalogo.categorias) ? catalogo.categorias : [];
    catalogo.productos = Array.isArray(catalogo.productos) ? catalogo.productos : [];
    catalogo.productos.forEach(p => {
        p.stock = parseInt(p.stock) || 0;
        p.estado = p.estado !== false;
        p.destacado = !!p.destacado;
    });
    return catalogo;
}

function bd_save_catalogo(catalogo) {
    catalogo.config = catalogo.config || {};
    catalogo.categorias = catalogo.categorias || [];
    catalogo.productos = catalogo.productos || [];
    return bd_write_json(BD_CATALOGO_FILE, catalogo);
}

function bd_price_to_float(value) {
    if (typeof value === 'number') return value;
    const text = String(value).replace(/\./g, '').replace(',', '.');
    const match = text.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
}

function bd_format_money(value) {
    return value.toFixed(2).replace('.', ',') + ' €';
}

function bd_money_safe(amount) {
    return '$ ' + number_format(amount, 0, ',', '.');
}

function number_format(number, decimals, dec_point, thousands_sep) {
    number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
    var n = !isFinite(+number) ? 0 : +number,
        prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
        sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
        dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
        s = '',
        toFixedFix = function (n, prec) {
            var k = Math.pow(10, prec);
            return '' + Math.round(n * k) / k;
        };
    s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join('0');
    }
    return s.join(dec);
}

function bd_next_id(items) {
    return Math.max(0, ...items.map(i => parseInt(i.id) || 0)) + 1;
}

function bd_find_product(catalogo, id) {
    return catalogo.productos.find(p => String(p.id) === String(id)) || null;
}

function bd_update_product_stock(productId, qtyChange) {
    const catalogo = bd_catalogo();
    const product = catalogo.productos.find(p => String(p.id) === String(productId));
    if (product) {
        product.stock = Math.max(0, (parseInt(product.stock) || 0) + qtyChange);
        bd_save_catalogo(catalogo);
    }
}

function bd_count_productos_categoria(productos, categoriaId) {
    return productos.filter(p => String(p.categoria || '') === String(categoriaId)).length;
}

function bd_tipo_categoria_label(tipo) {
    return tipo === 'individual' ? 'Productos individuales' : 'Ramos';
}

function bd_categoria_slug(text) {
    text = text.trim().toLowerCase();
    const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
    text = text.replace(/[áéíóúñ]/g, m => map[m]);
    text = text.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return text || 'categoria';
}

function bd_categoria_unique_id(baseId, categorias, currentId = '') {
    let id = bd_categoria_slug(baseId);
    let counter = 2;
    const ids = categorias.map(c => String(c.id || ''));
    while (ids.includes(id) && id !== currentId) {
        id = bd_categoria_slug(baseId) + '-' + counter;
        counter++;
    }
    return id;
}

function bd_find_categoria(categorias, id) {
    return categorias.find(c => String(c.id || '') === String(id)) || null;
}

function bd_load_presentaciones() {
    const file = BD_PRESENTACIONES_FILE;
    if (!fs.existsSync(file)) {
        bd_save_presentaciones(bd_presentaciones_default());
    }
    const data = bd_read_json(file, { presentaciones: [] });
    let items = data.presentaciones || data;
    if (!Array.isArray(items)) items = [];
    items.sort((a, b) => (a.orden || 999) - (b.orden || 999));
    return items;
}

function bd_save_presentaciones(items) {
    items.sort((a, b) => (a.orden || 999) - (b.orden || 999));
    bd_write_json(BD_PRESENTACIONES_FILE, { presentaciones: items });
}

function bd_presentaciones_default() {
    return [
        { id: 'ramo_full', icon: '💐', nombre: 'Ramo full', descripcion: 'Grande, llamativo y perfecto para regalo especial.', precioBase: 25000, orden: 1, estado: true },
        { id: 'ramo_mini', icon: '🌸', nombre: 'Ramo mini', descripcion: 'Detalle pequeño, bonito y económico.', precioBase: 15000, orden: 2, estado: true },
        { id: 'box_belleza', icon: '🎁', nombre: 'Box sorpresa', descripcion: 'Caja de regalo con productos seleccionados.', precioBase: 20000, orden: 3, estado: true },
        { id: 'pocillo', icon: '☕', nombre: 'Pocillo decorado', descripcion: 'Pocillo con maquillaje, dulces o accesorios.', precioBase: 18000, orden: 4, estado: true },
        { id: 'canasta', icon: '🧺', nombre: 'Canasta premium', descripcion: 'Presentación elegante con más espacio para detalles.', precioBase: 30000, orden: 5, estado: true },
    ];
}

function bd_presentacion_slug(text) {
    text = text.trim().toLowerCase();
    const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };
    text = text.replace(/[áéíóúñ]/g, m => map[m]);
    text = text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return text || 'presentacion';
}

function bd_unique_presentacion_id(baseId, items, currentId = '') {
    let id = bd_presentacion_slug(baseId);
    let counter = 2;
    const ids = items.map(i => String(i.id || ''));
    while (ids.includes(id) && id !== currentId) {
        id = bd_presentacion_slug(baseId) + '_' + counter;
        counter++;
    }
    return id;
}

function bd_find_presentacion(items, id) {
    return items.find(i => String(i.id || '') === String(id)) || null;
}

function bd_stats() {
    const catalogo = bd_catalogo();
    const pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
    const compras = bd_read_json(BD_COMPRAS_FILE, []);
    const usuarios = bd_read_json(BD_USUARIOS_FILE, []);

    const productosActivos = catalogo.productos.filter(p => p.estado !== false);
    const stockTotal = productosActivos.reduce((sum, p) => sum + (parseInt(p.stock) || 0), 0);
    const stockBajo = productosActivos.filter(p => (parseInt(p.stock) || 0) <= 3).length;

    let ventasTotal = 0;
    let pedidosPendientes = 0;
    let pedidosConfirmados = 0;

    pedidos.forEach(p => {
        const estado = p.estado || 'pendiente';
        if (estado === 'pendiente') pedidosPendientes++;
        if (['confirmado', 'entregado'].includes(estado)) {
            pedidosConfirmados++;
            ventasTotal += parseFloat(p.total) || 0;
        }
    });

    const comprasTotal = compras.reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);

    return {
        productos: productosActivos.length,
        stock_total: stockTotal,
        stock_bajo: stockBajo,
        pedidos: pedidos.length,
        pedidos_pendientes: pedidosPendientes,
        pedidos_confirmados: pedidosConfirmados,
        ventas_total: ventasTotal,
        compras_total: comprasTotal,
        usuarios: usuarios.filter(u => u.estado !== false).length,
    };
}

// Funciones para presentaciones
function bd_load_presentaciones() {
    const data = bd_read_json(BD_PRESENTACIONES_FILE, { presentaciones: [] });
    return data.presentaciones || [];
}

function bd_save_presentaciones(presentaciones) {
    return bd_write_json(BD_PRESENTACIONES_FILE, { presentaciones });
}

function bd_find_presentacion(presentaciones, id) {
    return presentaciones.find(p => String(p.id) === String(id));
}

function bd_presentacion_slug(text) {
    if (!text) return '';
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function bd_unique_presentacion_id(idInput, presentaciones, excludeId = null) {
    if (!idInput) return '';
    let baseId = bd_presentacion_slug(idInput);
    if (!baseId) return '';
    let id = baseId;
    let counter = 1;
    
    while (presentaciones.some(p => String(p.id) === id && String(p.id) !== String(excludeId))) {
        id = `${baseId}-${counter}`;
        counter++;
    }
    
    return id;
}

function bd_presentaciones_default() {
    return [
        {
            id: 'ramo_full',
            icon: '💐',
            nombre: 'Ramo full',
            descripcion: 'Grande, llamativo y perfecto para regalo especial.',
            precioBase: 25000,
            orden: 1,
            estado: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'ramo_mini',
            icon: '🌸',
            nombre: 'Ramo mini',
            descripcion: 'Detalle pequeño, bonito y económico.',
            precioBase: 15000,
            orden: 2,
            estado: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'box_belleza',
            icon: '🎁',
            nombre: 'Box sorpresa',
            descripcion: 'Caja de regalo con productos seleccionados.',
            precioBase: 20000,
            orden: 3,
            estado: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    ];
}

module.exports = {
    BD_DATA_DIR,
    BD_CATALOGO_FILE,
    BD_USUARIOS_FILE,
    BD_PEDIDOS_FILE,
    BD_COMPRAS_FILE,
    BD_ROLES_FILE,
    BD_PRESENTACIONES_FILE,
    bd_ensure_data_files,
    bd_read_json,
    bd_write_json,
    bd_h,
    bd_current_user,
    bd_require_login,
    bd_flash,
    bd_catalogo,
    bd_save_catalogo,
    bd_price_to_float,
    bd_format_money,
    bd_money_safe,
    bd_next_id,
    bd_find_product,
    bd_update_product_stock,
    bd_stats,
    bd_count_productos_categoria,
    bd_tipo_categoria_label,
    bd_categoria_slug,
    bd_categoria_unique_id,
    bd_find_categoria,
    bd_load_presentaciones,
    bd_save_presentaciones,
    bd_presentaciones_default,
    bd_presentacion_slug,
    bd_unique_presentacion_id,
    bd_find_presentacion,
};