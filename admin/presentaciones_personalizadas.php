<?php
require_once __DIR__ . '/_helpers.php';

bd_require_login();

function bd_presentaciones_file(): string
{
    return dirname(__DIR__) . '/data/presentaciones.json';
}

function bd_presentaciones_default(): array
{
    return [
        [
            'id' => 'ramo_full',
            'icon' => '💐',
            'nombre' => 'Ramo full',
            'descripcion' => 'Grande, llamativo y perfecto para regalo especial.',
            'precioBase' => 25000,
            'orden' => 1,
            'estado' => true,
        ],
        [
            'id' => 'ramo_mini',
            'icon' => '🌸',
            'nombre' => 'Ramo mini',
            'descripcion' => 'Detalle pequeño, bonito y económico.',
            'precioBase' => 15000,
            'orden' => 2,
            'estado' => true,
        ],
        [
            'id' => 'box_belleza',
            'icon' => '🎁',
            'nombre' => 'Box sorpresa',
            'descripcion' => 'Caja de regalo con productos seleccionados.',
            'precioBase' => 20000,
            'orden' => 3,
            'estado' => true,
        ],
        [
            'id' => 'pocillo',
            'icon' => '☕',
            'nombre' => 'Pocillo decorado',
            'descripcion' => 'Pocillo con maquillaje, dulces o accesorios.',
            'precioBase' => 18000,
            'orden' => 4,
            'estado' => true,
        ],
        [
            'id' => 'canasta',
            'icon' => '🧺',
            'nombre' => 'Canasta premium',
            'descripcion' => 'Presentación elegante con más espacio para detalles.',
            'precioBase' => 30000,
            'orden' => 5,
            'estado' => true,
        ],
    ];
}

function bd_load_presentaciones(): array
{
    $file = bd_presentaciones_file();

    if (!file_exists($file)) {
        bd_save_presentaciones(bd_presentaciones_default());
    }

    $json = file_get_contents($file);
    $data = json_decode($json, true);

    if (!is_array($data)) {
        return bd_presentaciones_default();
    }

    if (isset($data['presentaciones']) && is_array($data['presentaciones'])) {
        $items = $data['presentaciones'];
    } else {
        $items = $data;
    }

    usort($items, function ($a, $b) {
        return (int) ($a['orden'] ?? 999) <=> (int) ($b['orden'] ?? 999);
    });

    return $items;
}

function bd_save_presentaciones(array $items): void
{
    $file = bd_presentaciones_file();
    $dir = dirname($file);

    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    usort($items, function ($a, $b) {
        return (int) ($a['orden'] ?? 999) <=> (int) ($b['orden'] ?? 999);
    });

    $payload = [
        'presentaciones' => array_values($items),
    ];

    file_put_contents(
        $file,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
}

function bd_presentacion_slug(string $text): string
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
    $text = preg_replace('/[^a-z0-9]+/', '_', $text);
    $text = trim($text, '_');

    return $text ?: 'presentacion';
}

function bd_unique_presentacion_id(string $baseId, array $items, string $currentId = ''): string
{
    $baseId = bd_presentacion_slug($baseId);
    $id = $baseId;
    $counter = 2;

    $existingIds = array_map(function ($item) {
        return (string) ($item['id'] ?? '');
    }, $items);

    while (in_array($id, $existingIds, true) && $id !== $currentId) {
        $id = $baseId . '_' . $counter;
        $counter++;
    }

    return $id;
}

function bd_find_presentacion(array $items, string $id): ?array
{
    foreach ($items as $item) {
        if ((string) ($item['id'] ?? '') === $id) {
            return $item;
        }
    }

    return null;
}

function bd_presentacion_money($amount): string
{
    if (function_exists('bd_money')) {
        return bd_money($amount);
    }

    return '$ ' . number_format((float) $amount, 0, ',', '.');
}

function bd_presentacion_price_to_float($value): float
{
    if (function_exists('bd_price_to_float')) {
        return bd_price_to_float($value);
    }

    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }

    $value = preg_replace('/[^\d,.\-]/', '', (string) $value);

    if (strpos($value, ',') !== false) {
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
    }

    return is_numeric($value) ? (float) $value : 0;
}

$presentaciones = bd_load_presentaciones();
$editing = null;

if (isset($_GET['eliminar'])) {
    $id = (string) $_GET['eliminar'];

    $presentaciones = array_values(array_filter($presentaciones, function ($item) use ($id) {
        return (string) ($item['id'] ?? '') !== $id;
    }));

    bd_save_presentaciones($presentaciones);
    bd_flash('Presentación eliminada correctamente.');
    bd_redirect('presentaciones_personalizadas.php');
}

if (isset($_GET['editar'])) {
    $editing = bd_find_presentacion($presentaciones, (string) $_GET['editar']);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $idOriginal = trim($_POST['id_original'] ?? '');
    $idInput = trim($_POST['id'] ?? '');
    $nombre = trim($_POST['nombre'] ?? '');

    if ($idInput === '') {
        $idInput = $nombre;
    }

    $idFinal = bd_unique_presentacion_id($idInput, $presentaciones, $idOriginal);

    $presentacionNueva = [
        'id' => $idFinal,
        'icon' => trim($_POST['icon'] ?? '💐'),
        'nombre' => $nombre,
        'descripcion' => trim($_POST['descripcion'] ?? ''),
        'precioBase' => bd_presentacion_price_to_float($_POST['precioBase'] ?? 0),
        'orden' => (int) ($_POST['orden'] ?? 999),
        'estado' => isset($_POST['estado']),
        'updated_at' => date('c'),
    ];

    $found = false;

    foreach ($presentaciones as &$item) {
        if ((string) ($item['id'] ?? '') === $idOriginal && $idOriginal !== '') {
            $presentacionNueva['created_at'] = $item['created_at'] ?? date('c');
            $item = $presentacionNueva;
            $found = true;
            break;
        }
    }

    unset($item);

    if (!$found) {
        $presentacionNueva['created_at'] = date('c');
        $presentaciones[] = $presentacionNueva;
    }

    bd_save_presentaciones($presentaciones);
    bd_flash('Presentación guardada correctamente.');
    bd_redirect('presentaciones_personalizadas.php');
}

bd_admin_header('Presentaciones personalizadas', 'presentaciones');
?>

<section class="admin-card admin-toolbar-card">
  <div class="admin-card-header">
    <div>
      <h2>Presentaciones personalizadas</h2>
      <p>Administra los tipos de presentación que usa el constructor de ramos personalizados.</p>
    </div>

    <button type="button" class="btn btn-primary" data-open-presentation-modal>
      + Crear presentación
    </button>
  </div>
</section>

<div
  class="bd-modal-overlay <?= $editing ? 'is-open' : '' ?>"
  data-presentation-modal
  aria-hidden="<?= $editing ? 'false' : 'true' ?>"
>
  <div class="bd-modal">
    <div class="bd-modal-header">
      <div>
        <p class="eyebrow">Constructor personalizado</p>
        <h2><?= $editing ? 'Editar presentación' : 'Nueva presentación' ?></h2>
      </div>

      <button
        type="button"
        class="bd-modal-close"
        data-close-presentation-modal
        data-cancel-url="<?= $editing ? 'presentaciones_personalizadas.php' : '' ?>"
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
            placeholder="ramo_full"
          >
          <small class="field-help">
            Si lo dejas vacío, se genera automáticamente con el nombre.
          </small>
        </div>

        <div class="form-field">
          <label>Icono</label>
          <input
            name="icon"
            value="<?= bd_h((string) ($editing['icon'] ?? '💐')) ?>"
            placeholder="💐"
            required
          >
        </div>

        <div class="form-field">
          <label>Orden</label>
          <input
            name="orden"
            type="number"
            value="<?= (int) ($editing['orden'] ?? 1) ?>"
            min="1"
          >
        </div>

        <div class="form-field">
          <label>Nombre</label>
          <input
            name="nombre"
            value="<?= bd_h((string) ($editing['nombre'] ?? '')) ?>"
            placeholder="Ramo full"
            required
          >
        </div>

        <div class="form-field">
          <label>Precio base</label>
          <input
            name="precioBase"
            value="<?= bd_h((string) ($editing['precioBase'] ?? '')) ?>"
            placeholder="25000"
            required
          >
        </div>

        <div class="form-field">
          <label>Estado</label>
          <select name="estado_select" disabled>
            <option>Controlado por checkbox Visible</option>
          </select>
        </div>

        <div class="form-field full">
          <label>Descripción</label>
          <textarea name="descripcion" required><?= bd_h((string) ($editing['descripcion'] ?? '')) ?></textarea>
        </div>
      </div>

      <div class="form-checks" style="margin-top: 14px;">
        <label>
          <input type="checkbox" name="estado" <?= (($editing['estado'] ?? true) !== false) ? 'checked' : '' ?>>
          Visible en el constructor
        </label>
      </div>

      <div class="bd-modal-actions">
        <button class="btn btn-primary" type="submit">
          Guardar presentación
        </button>

        <button
          type="button"
          class="btn btn-soft"
          data-close-presentation-modal
          data-cancel-url="<?= $editing ? 'presentaciones_personalizadas.php' : '' ?>"
        >
          Cancelar
        </button>
      </div>
    </form>
  </div>
</div>

<section class="admin-card">
  <div class="admin-card-header">
    <h2>Listado de presentaciones</h2>
  </div>

  <div class="table-wrap table-wrap-presentations">
    <table class="presentations-table">
      <thead>
        <tr>
          <th>Orden</th>
          <th>Icono</th>
          <th>Presentación</th>
          <th>Precio base</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>

      <tbody>
        <?php foreach ($presentaciones as $item): ?>
          <?php $visible = (($item['estado'] ?? true) !== false); ?>

          <tr>
            <td data-label="Orden">
              <?= (int) ($item['orden'] ?? 999) ?>
            </td>

            <td data-label="Icono">
              <span class="presentation-icon"><?= bd_h((string) ($item['icon'] ?? '💐')) ?></span>
            </td>

            <td data-label="Presentación" class="td-product">
              <strong><?= bd_h((string) ($item['nombre'] ?? '')) ?></strong>
              <small><?= bd_h((string) ($item['id'] ?? '')) ?></small>
              <small><?= bd_h((string) ($item['descripcion'] ?? '')) ?></small>
            </td>

            <td data-label="Precio base" class="td-money">
              <?= bd_presentacion_money($item['precioBase'] ?? 0) ?>
            </td>

            <td data-label="Estado">
              <span class="status <?= $visible ? 'ok' : 'bad' ?>">
                <?= $visible ? 'Visible' : 'Oculto' ?>
              </span>
            </td>

            <td data-label="Acciones" class="td-actions">
              <a class="btn btn-soft" href="presentaciones_personalizadas.php?editar=<?= urlencode((string) ($item['id'] ?? '')) ?>">
                Editar
              </a>

              <a
                class="btn btn-danger"
                href="presentaciones_personalizadas.php?eliminar=<?= urlencode((string) ($item['id'] ?? '')) ?>"
                onclick="return confirm('¿Eliminar esta presentación? Si la eliminas ya no aparecerá en el constructor.')"
              >
                Eliminar
              </a>
            </td>
          </tr>
        <?php endforeach; ?>

        <?php if (empty($presentaciones)): ?>
          <tr>
            <td colspan="6">No hay presentaciones creadas todavía.</td>
          </tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</section>

<script>
  document.addEventListener('DOMContentLoaded', function () {
    const modal = document.querySelector('[data-presentation-modal]');
    const openButton = document.querySelector('[data-open-presentation-modal]');
    const closeButtons = document.querySelectorAll('[data-close-presentation-modal]');

    function openPresentationModal() {
      if (!modal) return;

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('bd-modal-open');
    }

    function closePresentationModal(button) {
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
      openButton.addEventListener('click', openPresentationModal);
    }

    closeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        closePresentationModal(button);
      });
    });

    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          const closeButton = document.querySelector('[data-close-presentation-modal]');
          closePresentationModal(closeButton);
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && modal.classList.contains('is-open')) {
        const closeButton = document.querySelector('[data-close-presentation-modal]');
        closePresentationModal(closeButton);
      }
    });
  });
</script>

<?php bd_admin_footer(); ?>