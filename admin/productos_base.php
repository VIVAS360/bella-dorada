<?php
require_once __DIR__ . '/_helpers.php';

function bd_upload_product_image(string $inputName = 'imagen_file'): ?string
{
    if (
        !isset($_FILES[$inputName]) ||
        !is_array($_FILES[$inputName]) ||
        ($_FILES[$inputName]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE
    ) {
        return null;
    }

    if ($_FILES[$inputName]['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo subir la imagen. Código de error: ' . $_FILES[$inputName]['error']);
    }

    $maxSize = 5 * 1024 * 1024; // 5MB

    if ($_FILES[$inputName]['size'] > $maxSize) {
        throw new RuntimeException('La imagen no puede superar los 5MB.');
    }

    $tmpPath = $_FILES[$inputName]['tmp_name'];
    $originalName = $_FILES[$inputName]['name'] ?? 'imagen';

    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    if (!in_array($extension, $allowedExtensions, true)) {
        throw new RuntimeException('Formato no permitido. Usa JPG, PNG, WEBP o GIF.');
    }

    $imageInfo = @getimagesize($tmpPath);

    if ($imageInfo === false) {
        throw new RuntimeException('El archivo subido no parece ser una imagen válida.');
    }

    $uploadDir = dirname(__DIR__) . '/assets/uploads/productos';

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '-', pathinfo($originalName, PATHINFO_FILENAME));
    $safeName = trim($safeName, '-');

    if ($safeName === '') {
        $safeName = 'producto';
    }

    $fileName = $safeName . '-' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
    $destination = $uploadDir . '/' . $fileName;

    if (!move_uploaded_file($tmpPath, $destination)) {
        throw new RuntimeException('No se pudo guardar la imagen en el servidor.');
    }

    return 'assets/uploads/productos/' . $fileName;
}

function bd_admin_image_url(?string $path): string
{
    $path = trim((string) $path);

    if ($path === '') {
        return '';
    }

    if (preg_match('/^https?:\/\//i', $path)) {
        return $path;
    }

    if (str_starts_with($path, 'assets/')) {
        return '../' . $path;
    }

    return $path;
}

function bd_producto_tipo_actual(array $producto): string
{
    return $producto['tipo_producto'] ?? 'ramos_full';
}

function bd_producto_pertenece_tipo(array $producto, string $tipo): bool
{
    return bd_producto_tipo_actual($producto) === $tipo;
}

function bd_money_safe($amount): string
{
    if (function_exists('bd_money')) {
        return bd_money($amount);
    }

    return '$ ' . number_format((float) $amount, 0, ',', '.');
}

function bd_categoria_tipo_actual(array $categoria): string
{
    return $categoria['tipo_categoria'] ?? $categoria['tipo'] ?? 'ramos';
}

function bd_categoria_pertenece_a_producto(array $categoria, string $tipoProducto): bool
{
    $tipoCategoria = bd_categoria_tipo_actual($categoria);

    if ($tipoProducto === 'individual') {
        return $tipoCategoria === 'individual';
    }

    return $tipoCategoria === 'ramos';
}

function bd_margin_class_safe(float $value): string
{
    if ($value < 0) return 'bad';
    if ($value <= 5000) return 'warn';
    return 'ok';
}

function bd_render_productos_admin(array $config): void
{
    bd_require_login();

    $active = $config['active'] ?? 'productos';
    $titulo = $config['titulo'] ?? 'Productos';
    $subtitulo = $config['subtitulo'] ?? '';
    $tipoProducto = $config['tipo_producto'] ?? 'ramos_full';
    $nombreBoton = $config['nombre_boton'] ?? 'Guardar producto';
    $nuevoTitulo = $config['nuevo_titulo'] ?? 'Nuevo producto';
    $editarTitulo = $config['editar_titulo'] ?? 'Editar producto';

    $catalogo = bd_catalogo();
    $editing = null;

    if (!isset($catalogo['productos']) || !is_array($catalogo['productos'])) {
        $catalogo['productos'] = [];
    }

    if (!isset($catalogo['categorias']) || !is_array($catalogo['categorias'])) {
        $catalogo['categorias'] = [];
    }

    if (isset($_GET['eliminar'])) {
        $id = (string) $_GET['eliminar'];

        foreach ($catalogo['productos'] as &$producto) {
            if (
                (string) ($producto['id'] ?? '') === $id
                && bd_producto_pertenece_tipo($producto, $tipoProducto)
            ) {
                $producto['estado'] = false;
                break;
            }
        }

        unset($producto);

        bd_save_catalogo($catalogo);
        bd_flash('Producto desactivado correctamente.');
        bd_redirect(basename($_SERVER['PHP_SELF']));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $id = trim($_POST['id'] ?? '');
        $tags = array_filter(array_map('trim', explode(',', $_POST['tags'] ?? '')));

        $imagenActual = trim($_POST['imagen_actual'] ?? '');
        $imagenUrl = trim($_POST['imagen'] ?? '');

        try {
            $imagenSubida = bd_upload_product_image('imagen_file');
        } catch (RuntimeException $error) {
            bd_flash($error->getMessage(), 'error');
            bd_redirect(basename($_SERVER['PHP_SELF']));
        }

        $imagenFinal = $imagenSubida ?: ($imagenUrl ?: $imagenActual);

        $productoNuevo = [
            'id' => $id !== '' ? (int) $id : bd_next_id($catalogo['productos']),
            'tipo_producto' => $tipoProducto,
            'codigo' => trim($_POST['codigo'] ?? ''),
            'nombre' => trim($_POST['nombre'] ?? ''),
            'categoria' => trim($_POST['categoria'] ?? ''),
            'descripcion' => trim($_POST['descripcion'] ?? ''),
            'precio' => trim($_POST['precio'] ?? '0'),
            'coste' => trim($_POST['coste'] ?? '0'),
            'stock' => max(0, (int) ($_POST['stock'] ?? 0)),
            'imagen' => $imagenFinal,
            'destacado' => isset($_POST['destacado']),
            'estado' => isset($_POST['estado']),
            'tags' => array_values($tags),
            'updated_at' => date('c'),
        ];

        $found = false;

        foreach ($catalogo['productos'] as &$producto) {
            if ((string) ($producto['id'] ?? '') === (string) $productoNuevo['id']) {
                $productoNuevo['created_at'] = $producto['created_at'] ?? date('c');
                $producto = $productoNuevo;
                $found = true;
                break;
            }
        }

        unset($producto);

        if (!$found) {
            $productoNuevo['created_at'] = date('c');
            $catalogo['productos'][] = $productoNuevo;
        }

        bd_save_catalogo($catalogo);
        bd_flash('Producto guardado correctamente.');
        bd_redirect(basename($_SERVER['PHP_SELF']));
    }

    if (isset($_GET['editar'])) {
        $productoEditar = bd_find_product($catalogo, $_GET['editar']);

        if ($productoEditar && bd_producto_pertenece_tipo($productoEditar, $tipoProducto)) {
            $editing = $productoEditar;
        }
    }

    $productos = array_values(array_filter($catalogo['productos'], function ($producto) use ($tipoProducto) {
        return bd_producto_pertenece_tipo($producto, $tipoProducto);
    }));

    $categorias = array_values(array_filter($catalogo['categorias'], function ($categoria) use ($tipoProducto, $editing) {
    $categoriaActualProducto = $editing['categoria'] ?? null;
    $esCategoriaActual = $categoriaActualProducto && (($categoria['id'] ?? '') === $categoriaActualProducto);

    if (!bd_categoria_pertenece_a_producto($categoria, $tipoProducto)) {
        return false;
    }

    /*
    * Si está oculta, no se muestra para productos nuevos.
    * Pero si estamos editando un producto que ya la tiene,
    * la dejamos visible para no romper la edición.
    */
    if (($categoria['estado'] ?? true) === false && !$esCategoriaActual) {
        return false;
    }

    return true;
}));

    bd_admin_header($titulo, $active);
    ?>

    <section class="admin-card admin-toolbar-card">
    <div class="admin-card-header">
        <div>
        <h2><?= bd_h($titulo) ?></h2>

        <?php if ($subtitulo): ?>
            <p><?= bd_h($subtitulo) ?></p>
        <?php endif; ?>
        </div>

        <button type="button" class="btn btn-primary" data-open-product-modal>
        + Crear nuevo
        </button>
    </div>
    </section>

    <div
    class="bd-modal-overlay <?= $editing ? 'is-open' : '' ?>"
    data-product-modal
    aria-hidden="<?= $editing ? 'false' : 'true' ?>"
    >
    <div class="bd-modal">
        <div class="bd-modal-header">
        <div>
            <p class="eyebrow">Gestión de producto</p>
            <h2><?= $editing ? bd_h($editarTitulo) : bd_h($nuevoTitulo) ?></h2>
        </div>

        <button
            type="button"
            class="bd-modal-close"
            data-close-product-modal
            data-cancel-url="<?= $editing ? bd_h(basename($_SERVER['PHP_SELF'])) : '' ?>"
            aria-label="Cerrar modal"
        >
            ×
        </button>
        </div>

        <form method="post" class="bd-modal-form" enctype="multipart/form-data">
        <input type="hidden" name="id" value="<?= bd_h((string) ($editing['id'] ?? '')) ?>">

        <div class="form-grid three">
            <div class="form-field">
            <label>Código</label>
            <input name="codigo" value="<?= bd_h($editing['codigo'] ?? '') ?>" required>
            </div>

            <div class="form-field">
            <label>Nombre</label>
            <input name="nombre" value="<?= bd_h($editing['nombre'] ?? '') ?>" required>
            </div>

            <div class="form-field">
            <label>Categoría</label>
            <select name="categoria" required>
                <option value="">Seleccionar</option>

                <?php foreach ($categorias as $cat): ?>
                <option value="<?= bd_h($cat['id']) ?>" <?= (($editing['categoria'] ?? '') === $cat['id']) ? 'selected' : '' ?>>
                    <?= bd_h($cat['nombre']) ?>
                </option>
                <?php endforeach; ?>
            </select>
            </div>

            <div class="form-field">
            <label>Precio venta</label>
            <input name="precio" value="<?= bd_h($editing['precio'] ?? '') ?>" placeholder="149900" required>
            </div>

            <div class="form-field">
            <label>Precio unidad / compra</label>
            <input name="coste" value="<?= bd_h($editing['coste'] ?? '') ?>" placeholder="85000">
            </div>

            <div class="form-field">
            <label>Stock disponible</label>
            <input name="stock" type="number" min="0" value="<?= (int) ($editing['stock'] ?? 0) ?>">
            </div>

            <div class="form-field full">
            <label>Imagen del producto</label>

            <input type="hidden" name="imagen_actual" value="<?= bd_h($editing['imagen'] ?? '') ?>">

            <?php if (!empty($editing['imagen'])): ?>
              <div class="image-preview-admin">
                <img src="<?= bd_h(bd_admin_image_url($editing['imagen'])) ?>" alt="Imagen actual">
                <div>
                  <strong>Imagen actual</strong>
                  <small><?= bd_h($editing['imagen']) ?></small>
                </div>
              </div>
            <?php endif; ?>

            <input
              type="file"
              name="imagen_file"
              accept="image/*"
            >

            <small class="field-help">
              Puede subir una imagen desde la galería del celular o desde la PC. Formatos permitidos: JPG, PNG, WEBP o GIF. Máximo 5MB.
            </small>

            <input
              name="imagen"
              value=""
              placeholder="O pega una URL externa opcional: https://..."
            >
          </div>

            <div class="form-field full">
            <label>Descripción</label>
            <textarea name="descripcion"><?= bd_h($editing['descripcion'] ?? '') ?></textarea>
            </div>

            <div class="form-field full">
            <label>Tags separados por coma</label>
            <input name="tags" value="<?= bd_h(implode(', ', $editing['tags'] ?? [])) ?>" placeholder="maquillaje, belleza, regalo">
            </div>
        </div>

        <div class="form-checks" style="margin-top: 14px;">
            <label>
            <input type="checkbox" name="destacado" <?= ($editing['destacado'] ?? false) ? 'checked' : '' ?>>
            Destacado
            </label>

            <label>
            <input type="checkbox" name="estado" <?= (($editing['estado'] ?? true) !== false) ? 'checked' : '' ?>>
            Visible
            </label>
        </div>

        <div class="bd-modal-actions">
            <button class="btn btn-primary" type="submit">
            <?= bd_h($nombreBoton) ?>
            </button>

            <button
            type="button"
            class="btn btn-soft"
            data-close-product-modal
            data-cancel-url="<?= $editing ? bd_h(basename($_SERVER['PHP_SELF'])) : '' ?>"
            >
            Cancelar
            </button>
        </div>
        </form>
    </div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', function () {
        const modal = document.querySelector('[data-product-modal]');
        const openButton = document.querySelector('[data-open-product-modal]');
        const closeButtons = document.querySelectorAll('[data-close-product-modal]');

        function openProductModal() {
        if (!modal) return;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('bd-modal-open');
        }

        function closeProductModal(button) {
        const cancelUrl = button?.dataset?.cancelUrl || '';

        if (cancelUrl) {
            window.location.href = cancelUrl;
            return;
        }

        if (!modal) return;

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('bd-modal-open');
        }

        if (modal && modal.classList.contains('is-open')) {
        document.body.classList.add('bd-modal-open');
        }

        if (openButton) {
        openButton.addEventListener('click', openProductModal);
        }

        closeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            closeProductModal(button);
        });
        });

        if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
            const editing = modal.classList.contains('is-open') && document.querySelector('input[name="id"]')?.value;

            if (editing) {
                window.location.href = '<?= bd_h(basename($_SERVER['PHP_SELF'])) ?>';
                return;
            }

            closeProductModal();
            }
        });
        }

        document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && modal && modal.classList.contains('is-open')) {
            const closeButton = document.querySelector('[data-close-product-modal]');
            closeProductModal(closeButton);
        }
        });
    });
    </script>

    <section class="admin-card">
      <div class="admin-card-header">
        <h2>Listado</h2>
      </div>

      <div class="table-wrap table-wrap-products">
        <table class="products-table">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Venta</th>
              <th>Unidad</th>
              <th>Ganancia</th>
              <th>Total</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <?php foreach ($productos as $producto): ?>
              <?php
                $stock = (int) ($producto['stock'] ?? 0);

                $precioVenta = bd_price_to_float($producto['precio'] ?? 0);
                $precioUnidad = bd_price_to_float($producto['coste'] ?? 0);

                $gananciaProducto = $precioVenta - $precioUnidad;
                $totalGanancias = $gananciaProducto * $stock;

                $estadoVisible = (($producto['estado'] ?? true) !== false);
              ?>

              <tr>
                <td data-label="Imagen">
                  <div class="product-thumb" style="background-image:url('<?= bd_h(bd_admin_image_url($producto['imagen'] ?? '')) ?>')"></div>
                </td>

                <td data-label="Producto" class="td-product">
                  <strong><?= bd_h($producto['nombre'] ?? '') ?></strong>
                  <small><?= bd_h($producto['codigo'] ?? '') ?></small>
                </td>

                <td data-label="Categoría" class="td-category">
                  <?= bd_h($producto['categoria'] ?? '') ?>
                </td>

                <td data-label="Precio venta" class="td-money">
                  <?= bd_money_safe($precioVenta) ?>
                </td>

                <td data-label="Precio unidad" class="td-money">
                  <?= bd_money_safe($precioUnidad) ?>
                </td>

                <td data-label="Ganancia producto" class="td-money">
                  <span class="status <?= bd_margin_class_safe($gananciaProducto) ?>">
                    <?= bd_money_safe($gananciaProducto) ?>
                  </span>
                </td>

                <td data-label="Total ganancias" class="td-money">
                  <strong><?= bd_money_safe($totalGanancias) ?></strong>
                </td>

                <td data-label="Stock">
                  <span class="status <?= ($stock <= 3) ? 'warn' : 'ok' ?>">
                    <?= $stock ?>
                  </span>
                </td>

                <td data-label="Estado">
                  <span class="status <?= $estadoVisible ? 'ok' : 'bad' ?>">
                    <?= $estadoVisible ? 'Visible' : 'Oculto' ?>
                  </span>
                </td>

                <td data-label="Acciones" class="td-actions">
                  <a class="btn btn-soft" href="<?= bd_h(basename($_SERVER['PHP_SELF'])) ?>?editar=<?= (int) $producto['id'] ?>">
                    Editar
                  </a>

                  <a
                    class="btn btn-danger"
                    href="<?= bd_h(basename($_SERVER['PHP_SELF'])) ?>?eliminar=<?= (int) $producto['id'] ?>"
                    onclick="return confirm('¿Desactivar este producto?')"
                  >
                    Ocultar
                  </a>
                </td>
              </tr>
            <?php endforeach; ?>

            <?php if (empty($productos)): ?>
              <tr>
                <td colspan="10">
                  No hay productos creados todavía.
                </td>
              </tr>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </section>

    <?php
    bd_admin_footer();
}