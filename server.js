const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const {
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
    BD_USUARIOS_FILE,
    BD_CATALOGO_FILE,
    BD_PEDIDOS_FILE,
    BD_COMPRAS_FILE,
    BD_ROLES_FILE,
    BD_PRESENTACIONES_FILE,
    bd_load_presentaciones,
    bd_save_presentaciones,
    bd_presentaciones_default,
    bd_presentacion_slug,
    bd_unique_presentacion_id,
    bd_find_presentacion,
} = require('./helpers');

const app = express();
const PORT = process.env.PORT || 3007;

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
    secret: 'bella-dorada-secret',
    resave: false,
    saveUninitialized: false,
}));
app.use(express.static(path.join(__dirname, 'admin/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'assets/uploads')));
app.use(express.static(path.join(__dirname)));

// Configurar multer para subidas
const upload = multer({
    dest: path.join(__dirname, 'assets/uploads/temp'),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo imágenes JPG, PNG, WEBP, GIF'));
        }
    }
});

// Asegurar archivos de datos
bd_ensure_data_files();

// Función para renderizar header
function renderHeader(title, active, req, res) {
    const user = bd_current_user(req);
    const flash = bd_flash(req);
    return { title, active, user, flash, bd_h };
}

// Función para renderizar footer
function renderFooter() {
    return {};
}

// Rutas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    if (bd_current_user(req)) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { error: '', bd_h });
});

app.post('/admin', (req, res) => {
    const { usuario, password } = req.body;
    const usuarios = bd_read_json(BD_USUARIOS_FILE, []);
    const user = usuarios.find(u => u.estado && u.usuario === usuario && bcrypt.compareSync(password, u.password));
    if (user) {
        const { password: _, ...userWithoutPassword } = user;
        req.session.bd_user = userWithoutPassword;
        // Also set cookie for serverless compatibility
        res.cookie('user_id', String(user.id), { maxAge: 24 * 60 * 60 * 1000 }); // 24 hours
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { error: 'Usuario o contraseña incorrectos.', bd_h });
});

app.get('/admin/dashboard', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const stats = bd_stats();
    const header = renderHeader('Dashboard', 'dashboard', req, res);
    res.render('admin/dashboard', { ...header, stats, bd_format_money });
});

app.get('/admin/productos', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    const productos = catalogo.productos.filter(p => p.tipo_producto === 'ramos_full');
    const categorias = catalogo.categorias.filter(c => c.tipo_categoria !== 'individual');
    const editing = req.query.editar ? productos.find(p => String(p.id) === req.query.editar) : null;
    const header = renderHeader('Ramos full', 'productos', req, res);
    res.render('admin/productos', { ...header, productos, categorias, editing, bd_format_money, bd_price_to_float, bd_money_safe });
});

app.post('/admin/productos', upload.single('imagen_file'), (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    const { id, codigo, nombre, categoria, descripcion, precio, coste, stock, imagen_actual, imagen, tags, destacado, estado } = req.body;
    let imagenFinal = imagen || imagen_actual;

    if (req.file) {
        const uploadDir = path.join(__dirname, 'assets/uploads/productos');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const ext = path.extname(req.file.originalname);
        const safeName = nombre.replace(/[^a-zA-Z0-9_\-]/g, '-').substring(0, 50);
        const fileName = `${safeName}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        const destPath = path.join(uploadDir, fileName);
        fs.renameSync(req.file.path, destPath);
        imagenFinal = `assets/uploads/productos/${fileName}`;
    }

    const productoNuevo = {
        id: id ? parseInt(id) : bd_next_id(catalogo.productos),
        tipo_producto: 'ramos_full',
        codigo: codigo || '',
        nombre: nombre || '',
        categoria: categoria || '',
        descripcion: descripcion || '',
        precio: precio || '0',
        coste: coste || '0',
        stock: Math.max(0, parseInt(stock) || 0),
        imagen: imagenFinal,
        destacado: !!destacado,
        estado: estado !== undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
        updated_at: new Date().toISOString(),
    };

    const index = catalogo.productos.findIndex(p => p.id === productoNuevo.id);
    if (index >= 0) {
        productoNuevo.created_at = catalogo.productos[index].created_at;
        catalogo.productos[index] = productoNuevo;
    } else {
        productoNuevo.created_at = new Date().toISOString();
        catalogo.productos.push(productoNuevo);
    }

    bd_save_catalogo(catalogo);
    req.session.bd_flash = { message: 'Producto guardado correctamente.', type: 'success' };
    res.redirect('/admin/productos');
});

app.get('/admin/pedidos', (req, res) => {
    if (!bd_require_login(req, res)) return;
    let pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
    pedidos.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const header = renderHeader('Pedidos', 'pedidos', req, res);
    res.render('admin/pedidos', { ...header, pedidos, bd_format_money });
});

app.post('/admin/pedidos', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const { pedido_id, estado } = req.body;
    let pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
    const pedido = pedidos.find(p => p.id === pedido_id);
    if (pedido) {
        const estadoAnterior = pedido.estado || 'pendiente';
        pedido.estado = estado;
        pedido.updated_at = new Date().toISOString();

        if (['confirmado', 'entregado'].includes(estado) && !pedido.stock_descontado) {
            pedido.items.forEach(item => {
                bd_update_product_stock(item.producto_id, -parseInt(item.cantidad || 0));
            });
            pedido.stock_descontado = true;
        }

        if (estado === 'cancelado' && pedido.stock_descontado) {
            pedido.items.forEach(item => {
                bd_update_product_stock(item.producto_id, parseInt(item.cantidad || 0));
            });
            pedido.stock_descontado = false;
        }

        bd_write_json(BD_PEDIDOS_FILE, pedidos);
        req.session.bd_flash = { message: 'Estado del pedido actualizado.', type: 'success' };
    }
    res.redirect('/admin/pedidos');
});

app.get('/admin/usuarios', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const usuarios = bd_read_json(BD_USUARIOS_FILE, []);
    const roles = bd_read_json(BD_ROLES_FILE, []);
    const header = renderHeader('Usuarios', 'usuarios', req, res);
    res.render('admin/usuarios', { ...header, usuarios, roles });
});

app.post('/admin/usuarios', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const { nombre, usuario, email, password, rol } = req.body;
    if (password.length < 6) {
        req.session.bd_flash = { message: 'La contraseña debe tener mínimo 6 caracteres.', type: 'error' };
        return res.redirect('/admin/usuarios');
    }
    let usuarios = bd_read_json(BD_USUARIOS_FILE, []);
    usuarios.push({
        id: bd_next_id(usuarios),
        nombre: nombre.trim(),
        usuario: usuario.trim(),
        email: email.trim(),
        password: bcrypt.hashSync(password, 10),
        rol: rol.trim() || 'ventas',
        estado: true,
        created_at: new Date().toISOString(),
    });
    bd_write_json(BD_USUARIOS_FILE, usuarios);
    req.session.bd_flash = { message: 'Usuario creado correctamente.', type: 'success' };
    res.redirect('/admin/usuarios');
});

app.get('/admin/usuarios/desactivar/:id', (req, res) => {
    if (!bd_require_login(req, res)) return;
    let usuarios = bd_read_json(BD_USUARIOS_FILE, []);
    const user = usuarios.find(u => String(u.id) === req.params.id);
    if (user) {
        user.estado = false;
        bd_write_json(BD_USUARIOS_FILE, usuarios);
        req.session.bd_flash = { message: 'Usuario desactivado.', type: 'success' };
    }
    res.redirect('/admin/usuarios');
});

app.get('/admin/compras', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    let compras = bd_read_json(BD_COMPRAS_FILE, []);
    compras.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const productosActivos = catalogo.productos.filter(p => p.estado !== false);
    const header = renderHeader('Compras', 'compras', req, res);
    res.render('admin/compras', { ...header, compras, productosActivos, bd_format_money });
});

app.post('/admin/compras', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const { producto_id, proveedor, cantidad, costo_unitario, nota } = req.body;
    const catalogo = bd_catalogo();
    const producto = bd_find_product(catalogo, producto_id);
    if (!producto) {
        req.session.bd_flash = { message: 'Producto no encontrado.', type: 'error' };
        return res.redirect('/admin/compras');
    }
    const qty = Math.max(1, parseInt(cantidad) || 1);
    const costo = bd_price_to_float(costo_unitario || 0);
    let compras = bd_read_json(BD_COMPRAS_FILE, []);
    compras.push({
        id: bd_next_id(compras),
        producto_id: parseInt(producto_id),
        producto_nombre: producto.nombre || '',
        proveedor: proveedor.trim(),
        cantidad: qty,
        costo_unitario: costo,
        total: costo * qty,
        nota: nota.trim(),
        created_at: new Date().toISOString(),
    });
    bd_write_json(BD_COMPRAS_FILE, compras);
    bd_update_product_stock(producto_id, qty);
    req.session.bd_flash = { message: 'Compra registrada y stock actualizado.', type: 'success' };
    res.redirect('/admin/compras');
});

app.get('/admin/categorias', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    let categorias = catalogo.categorias || [];
    categorias.sort((a, b) => (a.orden || 999) - (b.orden || 999));
    const productos = catalogo.productos || [];
    const editing = req.query.editar ? bd_find_categoria(categorias, req.query.editar) : null;
    const header = renderHeader('Categorías', 'categorias', req, res);
    res.render('admin/categorias', { ...header, categorias, productos, editing, bd_count_productos_categoria, bd_tipo_categoria_label });
});

app.post('/admin/categorias', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const { id_original, id, nombre, tipo_categoria, orden, estado } = req.body;
    const catalogo = bd_catalogo();
    let idInput = id.trim() || nombre.trim();
    const idFinal = bd_categoria_unique_id(idInput, catalogo.categorias, id_original);
    const categoriaNueva = {
        id: idFinal,
        nombre: nombre.trim(),
        tipo_categoria: tipo_categoria === 'individual' ? 'individual' : 'ramos',
        orden: parseInt(orden) || 999,
        estado: estado !== undefined,
        updated_at: new Date().toISOString(),
    };
    let found = false;
    if (id_original) {
        const index = catalogo.categorias.findIndex(c => String(c.id) === id_original);
        if (index >= 0) {
            categoriaNueva.created_at = catalogo.categorias[index].created_at;
            catalogo.categorias[index] = categoriaNueva;
            found = true;
            // Update products if id changed
            if (id_original !== idFinal) {
                catalogo.productos.forEach(p => {
                    if (String(p.categoria) === id_original) {
                        p.categoria = idFinal;
                        p.updated_at = new Date().toISOString();
                    }
                });
            }
        }
    }
    if (!found) {
        categoriaNueva.created_at = new Date().toISOString();
        catalogo.categorias.push(categoriaNueva);
    }
    catalogo.categorias.sort((a, b) => (a.orden || 999) - (b.orden || 999));
    bd_save_catalogo(catalogo);
    req.session.bd_flash = { message: 'Categoría guardada correctamente.', type: 'success' };
    res.redirect('/admin/categorias');
});

app.get('/admin/categorias/ocultar/:id', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    const categoria = bd_find_categoria(catalogo.categorias, req.params.id);
    if (categoria) {
        categoria.estado = false;
        categoria.updated_at = new Date().toISOString();
        bd_save_catalogo(catalogo);
        req.session.bd_flash = { message: 'Categoría ocultada correctamente.', type: 'success' };
    }
    res.redirect('/admin/categorias');
});

app.get('/admin/categorias/activar/:id', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    const categoria = bd_find_categoria(catalogo.categorias, req.params.id);
    if (categoria) {
        categoria.estado = true;
        categoria.updated_at = new Date().toISOString();
        bd_save_catalogo(catalogo);
        req.session.bd_flash = { message: 'Categoría activada correctamente.', type: 'success' };
    }
    res.redirect('/admin/categorias');
});

app.get('/admin/categorias/eliminar/:id', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    const productosVinculados = bd_count_productos_categoria(catalogo.productos, req.params.id);
    if (productosVinculados > 0) {
        req.session.bd_flash = { message: 'No se puede eliminar esta categoría porque tiene ' + productosVinculados + ' producto(s) vinculado(s). Puede ocultarla si no desea mostrarla en la web.', type: 'error' };
        return res.redirect('/admin/categorias');
    }
    catalogo.categorias = catalogo.categorias.filter(c => String(c.id) !== req.params.id);
    bd_save_catalogo(catalogo);
    req.session.bd_flash = { message: 'Categoría eliminada correctamente.', type: 'success' };
    res.redirect('/admin/categorias');
});

app.get('/admin/productos_individuales', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    let productos = catalogo.productos.filter(p => p.tipo_producto === 'individual' && p.estado !== false);
    productos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const categorias = catalogo.categorias.filter(c => c.tipo_categoria === 'individual' && c.estado !== false);
    const editing = req.query.editar ? productos.find(p => String(p.id) === req.query.editar) : null;
    const header = renderHeader('Productos individuales', 'productos_individuales', req, res);
    res.render('admin/productos_individuales', { ...header, productos, categorias, editing, bd_format_money, bd_money_safe });
});

app.post('/admin/productos_individuales', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const { id, codigo, nombre, categoria, descripcion, precio, coste, stock, imagen, imagen_actual, destacado, estado, tags } = req.body;
    const catalogo = bd_catalogo();
    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
    let imagenFinal = imagen || imagen_actual || '';
    if (req.file) {
        const uploadPath = path.join(__dirname, 'assets/uploads/productos');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        const ext = path.extname(req.file.originalname);
        const safeName = (nombre || 'producto').replace(/[^a-zA-Z0-9_\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const fileName = `${safeName}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}${ext}`;
        const fullPath = path.join(uploadPath, fileName);
        fs.writeFileSync(fullPath, req.file.buffer);
        imagenFinal = `assets/uploads/productos/${fileName}`;
    }
    const productoNuevo = {
        id: id ? parseInt(id) : bd_next_id(catalogo.productos),
        tipo_producto: 'individual',
        codigo: (codigo || '').trim(),
        nombre: (nombre || '').trim(),
        categoria: (categoria || '').trim(),
        descripcion: (descripcion || '').trim(),
        precio: (precio || '').trim(),
        coste: (coste || '').trim(),
        stock: Math.max(0, parseInt(stock) || 0),
        imagen: imagenFinal,
        destacado: destacado === 'on',
        estado: estado !== undefined,
        tags: tagsArray,
        updated_at: new Date().toISOString(),
    };
    let found = false;
    for (let i = 0; i < catalogo.productos.length; i++) {
        if (String(catalogo.productos[i].id) === String(productoNuevo.id)) {
            productoNuevo.created_at = catalogo.productos[i].created_at;
            catalogo.productos[i] = productoNuevo;
            found = true;
            break;
        }
    }
    if (!found) {
        productoNuevo.created_at = new Date().toISOString();
        catalogo.productos.push(productoNuevo);
    }
    bd_save_catalogo(catalogo);
    req.session.bd_flash = { message: 'Producto guardado correctamente.', type: 'success' };
    res.redirect('/admin/productos_individuales');
});

app.get('/admin/productos_individuales/eliminar/:id', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const catalogo = bd_catalogo();
    const producto = catalogo.productos.find(p => String(p.id) === req.params.id && p.tipo_producto === 'individual');
    if (producto) {
        producto.estado = false;
        producto.updated_at = new Date().toISOString();
        bd_save_catalogo(catalogo);
        req.session.bd_flash = { message: 'Producto desactivado correctamente.', type: 'success' };
    }
    res.redirect('/admin/productos_individuales');
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error destroying session:', err);
        res.clearCookie('user_id');
        res.redirect('/admin');
    });
});

app.get('/admin/presentaciones', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const presentaciones = bd_load_presentaciones();
    const editing = req.query.editar ? bd_find_presentacion(presentaciones, req.query.editar) : null;
    const header = renderHeader('Presentaciones personalizadas', 'presentaciones', req, res);
    res.render('admin/presentaciones', { ...header, presentaciones, editing, bd_format_money });
});

app.post('/admin/presentaciones', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const { id_original, id, icon, nombre, descripcion, precioBase, orden, estado } = req.body;
    let presentaciones = bd_load_presentaciones();
    const idInput = (id || '').trim() || (nombre || '').trim();
    const idFinal = bd_unique_presentacion_id(idInput, presentaciones, id_original);
    const presentacionNueva = {
        id: idFinal,
        icon: (icon || '').trim() || '💐',
        nombre: (nombre || '').trim(),
        descripcion: (descripcion || '').trim(),
        precioBase: bd_price_to_float(precioBase || 0),
        orden: parseInt(orden) || 999,
        estado: estado !== undefined,
        updated_at: new Date().toISOString(),
    };
    let found = false;
    for (let i = 0; i < presentaciones.length; i++) {
        if (String(presentaciones[i].id) === id_original && id_original) {
            presentacionNueva.created_at = presentaciones[i].created_at;
            presentaciones[i] = presentacionNueva;
            found = true;
            break;
        }
    }
    if (!found) {
        presentacionNueva.created_at = new Date().toISOString();
        presentaciones.push(presentacionNueva);
    }
    bd_save_presentaciones(presentaciones);
    req.session.bd_flash = { message: 'Presentación guardada correctamente.', type: 'success' };
    res.redirect('/admin/presentaciones');
});

app.get('/admin/presentaciones/eliminar/:id', (req, res) => {
    if (!bd_require_login(req, res)) return;
    let presentaciones = bd_load_presentaciones();
    presentaciones = presentaciones.filter(p => String(p.id) !== req.params.id);
    bd_save_presentaciones(presentaciones);
    req.session.bd_flash = { message: 'Presentación eliminada correctamente.', type: 'success' };
    res.redirect('/admin/presentaciones');
});

app.get('/admin/roles', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const roles = bd_read_json(BD_ROLES_FILE, []);
    const header = renderHeader('Roles', 'roles', req, res);
    res.render('admin/roles', { ...header, roles });
});

app.get('/admin/ventas', (req, res) => {
    if (!bd_require_login(req, res)) return;
    const pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
    const ventas = pedidos.filter(p => ['confirmado', 'entregado'].includes(p.estado || ''));
    const total = ventas.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const header = renderHeader('Ventas', 'ventas', req, res);
    res.render('admin/ventas', { ...header, ventas, total, bd_format_money });
});
// API para crear pedidos desde el frontend
app.post('/admin/api', (req, res) => {
    const action = req.query.action;
    if (action !== 'crear_pedido') {
        return res.status(404).json({ ok: false, message: 'Acción no encontrada' });
    }

    try {
        const payload = req.body;
        if (!Array.isArray(payload)) {
            throw new Error('JSON inválido.');
        }

        const itemsPayload = payload.items || [];
        if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
            throw new Error('El pedido no tiene productos.');
        }

        const catalogo = bd_catalogo();
        const items = [];
        let total = 0.0;

        for (const item of itemsPayload) {
            const productoId = item.producto_id || item.id;
            const cantidad = Math.max(1, parseInt(item.cantidad) || 1);
            const producto = bd_find_product(catalogo, String(productoId));

            if (!producto || producto.estado === false) {
                continue;
            }

            const precio = bd_price_to_float(producto.precio || 0);
            const subtotal = precio * cantidad;
            total += subtotal;

            items.push({
                producto_id: producto.id,
                codigo: producto.codigo || '',
                nombre: producto.nombre || '',
                cantidad,
                precio_unitario: precio,
                subtotal,
            });
        }

        if (items.length === 0) {
            throw new Error('No se pudo validar ningún producto del pedido.');
        }

        const pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
        const pedidoId = 'BD-' + new Date().toISOString().slice(0, 19).replace(/[:-]/g, '') + '-' + Math.floor(Math.random() * 900 + 100);

        const pedido = {
            id: pedidoId,
            origen: 'web-whatsapp',
            cliente: {
                nombre: payload.cliente?.nombre?.trim() || 'Cliente WhatsApp',
                telefono: payload.cliente?.telefono?.trim() || '',
                nota: payload.cliente?.nota?.trim() || '',
            },
            items,
            total,
            estado: 'pendiente',
            stock_descontado: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        pedidos.push(pedido);
        bd_write_json(BD_PEDIDOS_FILE, pedidos);

        res.json({ ok: true, pedido_id: pedidoId, pedido });
    } catch (e) {
        res.status(400).json({ ok: false, message: e.message });
    }
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});