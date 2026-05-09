<?php
require_once __DIR__ . '/_helpers.php';

bd_require_login();

function bd_categoria_slug(string $text): string
{
    $text = trim($text);
    $text = mb_strtolower($text, 'UTF-8');

    $map = [
        'á' => 'a',
        'é' => 'e',
        'í' => 'i',
        'ó' => 'o',
        'ú' => 'u',
        'ñ' => 'n',
    ];

    $text = strtr($text, $map);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');

    return $text ?: 'categoria';
}

function bd_categoria_unique_id(string $baseId, array $categorias, string $currentId = ''): string
{
    $baseId = bd_categoria_slug($baseId);
    $id = $baseId;
    $counter = 2;

    $ids = array_map(function ($categoria) {
        return (string) ($categoria['id'] ?? '');
    }, $categorias);

    while (in_array($id, $ids, true) && $id !== $currentId) {
        $id = $baseId . '-' . $counter;
        $counter++;
    }

    return $id;
}

function bd_find_categoria(array $categorias, string $id): ?array
{
    foreach ($categorias as $categoria) {
        if ((string) ($categoria['id'] ?? '') === $id) {
            return $categoria;
        }
    }

    return null;
}

function bd_count_productos_categoria(array $productos, string $categoriaId): int
{
    $total = 0;

    foreach ($productos as $producto) {
        if ((string) ($producto['categoria'] ?? '') === $categoriaId) {
            $total++;
        }
    }

    return $total;
}

function bd_tipo_categoria_label(string $tipo): string
{
    return $tipo === 'individual' ? 'Productos individuales' : 'Ramos';
}

$catalogo = bd_catalogo();

if (!isset($catalogo['categorias']) || !is_array($catalogo['categorias'])) {
    $catalogo['categorias'] = [];
}

if (!isset($catalogo['productos']) || !is_array($catalogo['productos'])) {
    $catalogo['productos'] = [];
}

$categorias = $catalogo['categorias'];
$productos = $catalogo['productos'];
$editing = null;

if (isset($_GET['ocultar'])) {
    $id = (string) $_GET['ocultar'];

    foreach ($catalogo['categorias'] as &$categoria) {
        if ((string) ($categoria['id'] ?? '') === $id) {
            $categoria['estado'] = false;
            $categoria['updated_at'] = date('c');
            break;
        }
    }

    unset($categoria);

    bd_save_catalogo($catalogo);
    bd_flash('Categoría ocultada correctamente.');
    bd_redirect('categorias.php');
}

if (isset($_GET['activar'])) {
    $id = (string) $_GET['activar'];

    foreach ($catalogo['categorias'] as &$categoria) {
        if ((string) ($categoria['id'] ?? '') === $id) {
            $categoria['estado'] = true;
            $categoria['updated_at'] = date('c');
            break;
        }
    }

    unset($categoria);

    bd_save_catalogo($catalogo);
    bd_flash('Categoría activada correctamente.');
    bd_redirect('categorias.php');
}

if (isset($_GET['eliminar'])) {
    $id = (string) $_GET['eliminar'];
    $productosVinculados = bd_count_productos_categoria($productos, $id);

    if ($productosVinculados > 0) {
        bd_flash(
            'No se puede eliminar esta categoría porque tiene ' . $productosVinculados . ' producto(s) vinculado(s). Puede ocultarla si no desea mostrarla en la web.',
            'error'
        );
        bd_redirect('categorias.php');
    }

    $catalogo['categorias'] = array_values(array_filter($catalogo['categorias'], function ($categoria) use ($id) {
        return (string) ($categoria['id'] ?? '') !== $id;
    }));

    bd_save_catalogo($catalogo);
    bd_flash('Categoría eliminada correctamente.');
    bd_redirect('categorias.php');
}

if (isset($_GET['editar'])) {
    $editing = bd_find_categoria($categorias, (string) $_GET['editar']);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $idOriginal = trim($_POST['id_original'] ?? '');
    $idInput = trim($_POST['id'] ?? '');
    $nombre = trim($_POST['nombre'] ?? '');

    if ($idInput === '') {
        $idInput = $nombre;
    }

    $idFinal = bd_categoria_unique_id($idInput, $catalogo['categorias'], $idOriginal);

    $categoriaNueva = [
        'id' => $idFinal,
        'nombre' => $nombre,
        'tipo_categoria' => $_POST['tipo_categoria'] === 'individual' ? 'individual' : 'ramos',
        'orden' => (int) ($_POST['orden'] ?? 999),
        'estado' => isset($_POST['estado']),
        'updated_at' => date('c'),
    ];

    $found = false;

    foreach ($catalogo['categorias'] as &$categoria) {
        if ((string) ($categoria['id'] ?? '') === $idOriginal && $idOriginal !== '') {
            $categoriaNueva['created_at'] = $categoria['created_at'] ?? date('c');
            $categoria = $categoriaNueva;
            $found = true;
            break;
        }
    }

    unset($categoria);

    if (!$found) {
        $categoriaNueva['created_at'] = date('c');
        $catalogo['categorias'][] = $categoriaNueva;
    }

    /*
     * Si se edita el ID de una categoría existente,
     * actualizamos los productos vinculados para no romper la relación.
     */
    if ($idOriginal !== '' && $idOriginal !== $idFinal) {
        foreach ($catalogo['productos'] as &$producto) {
            if ((string) ($producto['categoria'] ?? '') === $idOriginal) {
                $producto['categoria'] = $idFinal;
                $producto['updated_at'] = date('c');
            }
        }

        unset($producto);
    }

    usort($catalogo['categorias'], function ($a, $b) {
        return (int) ($a['orden'] ?? 999) <=> (int) ($b['orden'] ?? 999);
    });

    bd_save_catalogo($catalogo);
    bd_flash('Categoría guardada correctamente.');
    bd_redirect('categorias.php');
}

usort($categorias, function ($a, $b) {
    return (int) ($a['orden'] ?? 999) <=> (int) ($b['orden'] ?? 999);
});

bd_admin_header('Categorías', 'categorias');
?>

<section class="admin-card admin-toolbar-card">
  <div class="admin-card-header">
    <div>
      <h2>Categorías</h2>
      <p>Administra las categorías de ramos y de productos individuales.</p>
    </div>

    <button type="button" class="btn btn-primary" data-open-category-modal>
      + Crear categoría
    </button>
  </div>
</section>

<div
  class="bd-modal-overlay <?= $editing ? 'is-open' : '' ?>"
  data-category-modal
  aria-hidden="<?= $editing ? 'false' : 'true' ?>"
>
  <div class="bd-modal">
    <div class="bd-modal-header">
      <div>
        <p class="eyebrow">Catálogo Bella Dorada</p>
        <h2><?= $editing ? 'Editar categoría' : 'Nueva categoría' ?></h2>
      </div>

      <button
        type="button"
        class="bd-modal-close"
        data-close-category-modal
        data-cancel-url="<?= $editing ? 'categorias.php' : '' ?>"
        aria-label="Cerrar modal"
      >
        ×
      </button>
    </div>

    <form method="post" class="bd-modal-form">
      <input type="hidden" name="id_original" value="<?= bd_h((string) ($editing['id'] ?? '')) ?>">

      <div class="form-grid three">
        <div class="form-field">
          <label>Identificador</label>
          <input
            name="id"
            value="<?= bd_h((string) ($editing['id'] ?? '')) ?>"
            placeholder="maquillaje-individual"
          >
          <small class="field-help">
            Si lo deja vacío, se genera automáticamente con el nombre.
          </small>
        </div>

        <div class="form-field">
          <label>Nombre</label>
          <input
            name="nombre"
            value="<?= bd_h((string) ($editing['nombre'] ?? '')) ?>"
            placeholder="Maquillaje individual"
            required
          >
        </div>

        <div class="form-field">
          <label>Tipo de categoría</label>
          <select name="tipo_categoria" required>
            <option value="ramos" <?= (($editing['tipo_categoria'] ?? 'ramos') === 'ramos') ? 'selected' : '' ?>>
              Ramos
            </option>
            <option value="individual" <?= (($editing['tipo_categoria'] ?? '') === 'individual') ? 'selected' : '' ?>>
              Productos individuales
            </option>
          </select>
        </div>

        <div class="form-field">
          <label>Orden</label>
          <input
            name="orden"
            type="number"
            min="1"
            value="<?= (int) ($editing['orden'] ?? 1) ?>"
          >
        </div>
      </div>

      <div class="form-checks" style="margin-top: 14px;">
        <label>
          <input type="checkbox" name="estado" <?= (($editing['estado'] ?? true) !== false) ? 'checked' : '' ?>>
          Visible
        </label>
      </div>

      <div class="bd-modal-actions">
        <button class="btn btn-primary" type="submit">
          Guardar categoría
        </button>

        <button
          type="button"
          class="btn btn-soft"
          data-close-category-modal
          data-cancel-url="<?= $editing ? 'categorias.php' : '' ?>"
        >
          Cancelar
        </button>
      </div>
    </form>
  </div>
</div>

<section class="admin-card">
  <div class="admin-card-header">
    <h2>Listado de categorías</h2>
  </div>

  <div class="table-wrap table-wrap-categories">
    <table class="categories-table">
      <thead>
        <tr>
          <th>Orden</th>
          <th>Categoría</th>
          <th>Tipo</th>
          <th>Productos</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>

      <tbody>
        <?php foreach ($categorias as $categoria): ?>
          <?php
            $idCategoria = (string) ($categoria['id'] ?? '');
            $productosVinculados = bd_count_productos_categoria($productos, $idCategoria);
            $visible = (($categoria['estado'] ?? true) !== false);
          ?>

          <tr>
            <td data-label="Orden">
              <?= (int) ($categoria['orden'] ?? 999) ?>
            </td>

            <td data-label="Categoría" class="td-product">
              <strong><?= bd_h((string) ($categoria['nombre'] ?? '')) ?></strong>
              <small><?= bd_h($idCategoria) ?></small>
            </td>

            <td data-label="Tipo">
              <span class="status <?= (($categoria['tipo_categoria'] ?? 'ramos') === 'individual') ? 'warn' : 'ok' ?>">
                <?= bd_h(bd_tipo_categoria_label((string) ($categoria['tipo_categoria'] ?? 'ramos'))) ?>
              </span>
            </td>

            <td data-label="Productos">
              <span class="status <?= $productosVinculados > 0 ? 'ok' : 'warn' ?>">
                <?= $productosVinculados ?>
              </span>
            </td>

            <td data-label="Estado">
              <span class="status <?= $visible ? 'ok' : 'bad' ?>">
                <?= $visible ? 'Visible' : 'Oculta' ?>
              </span>
            </td>

            <td data-label="Acciones" class="td-actions">
              <a class="btn btn-soft" href="categorias.php?editar=<?= urlencode($idCategoria) ?>">
                Editar
              </a>

              <?php if ($visible): ?>
                <a
                  class="btn btn-danger"
                  href="categorias.php?ocultar=<?= urlencode($idCategoria) ?>"
                  onclick="return confirm('¿Ocultar esta categoría? Los productos vinculados dejarán de mostrarse en la web.')"
                >
                  Ocultar
                </a>
              <?php else: ?>
                <a class="btn btn-soft" href="categorias.php?activar=<?= urlencode($idCategoria) ?>">
                  Activar
                </a>
              <?php endif; ?>

              <?php if ($productosVinculados <= 0): ?>
                <a
                  class="btn btn-danger"
                  href="categorias.php?eliminar=<?= urlencode($idCategoria) ?>"
                  onclick="return confirm('¿Eliminar definitivamente esta categoría?')"
                >
                  Eliminar
                </a>
              <?php else: ?>
                <button
                  type="button"
                  class="btn btn-disabled"
                  disabled
                  title="No se puede eliminar porque tiene productos vinculados"
                >
                  Eliminar
                </button>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>

        <?php if (empty($categorias)): ?>
          <tr>
            <td colspan="6">No hay categorías creadas todavía.</td>
          </tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</section>

<script>
  document.addEventListener('DOMContentLoaded', function () {
    const modal = document.querySelector('[data-category-modal]');
    const openButton = document.querySelector('[data-open-category-modal]');
    const closeButtons = document.querySelectorAll('[data-close-category-modal]');

    function openCategoryModal() {
      if (!modal) return;

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('bd-modal-open');
    }

    function closeCategoryModal(button) {
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
      openButton.addEventListener('click', openCategoryModal);
    }

    closeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        closeCategoryModal(button);
      });
    });

    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          const closeButton = document.querySelector('[data-close-category-modal]');
          closeCategoryModal(closeButton);
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && modal.classList.contains('is-open')) {
        const closeButton = document.querySelector('[data-close-category-modal]');
        closeCategoryModal(closeButton);
      }
    });
  });
</script>

<?php bd_admin_footer(); ?>