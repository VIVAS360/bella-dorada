<?php
require_once __DIR__ . '/_helpers.php';
bd_require_login();

$catalogo = bd_catalogo();
$compras = bd_read_json(BD_COMPRAS_FILE, []);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $productoId = (int) ($_POST['producto_id'] ?? 0);
    $cantidad = max(1, (int) ($_POST['cantidad'] ?? 1));
    $costoUnitario = bd_price_to_float($_POST['costo_unitario'] ?? 0);
    $producto = bd_find_product($catalogo, $productoId);

    if (!$producto) {
        bd_flash('Producto no encontrado.', 'error');
        bd_redirect('compras.php');
    }

    $compras[] = [
        'id' => bd_next_id($compras),
        'producto_id' => $productoId,
        'producto_nombre' => $producto['nombre'] ?? '',
        'proveedor' => trim($_POST['proveedor'] ?? ''),
        'cantidad' => $cantidad,
        'costo_unitario' => $costoUnitario,
        'total' => $costoUnitario * $cantidad,
        'nota' => trim($_POST['nota'] ?? ''),
        'created_at' => date('c'),
    ];

    bd_write_json(BD_COMPRAS_FILE, $compras);
    bd_update_product_stock($productoId, $cantidad);
    bd_flash('Compra registrada y stock actualizado.');
    bd_redirect('compras.php');
}

usort($compras, fn ($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
$productosActivos = array_values(array_filter($catalogo['productos'], fn ($p) => ($p['estado'] ?? true) !== false));

bd_admin_header('Compras', 'compras');
?>
<section class="admin-card">
  <div class="admin-card-header"><h2>Registrar compra / entrada de stock</h2></div>
  <form method="post">
    <div class="form-grid three">
      <div class="form-field">
        <label>Producto</label>
        <select name="producto_id" required>
          <option value="">Seleccionar</option>
          <?php foreach ($productosActivos as $producto): ?>
            <option value="<?= (int) $producto['id'] ?>"><?= bd_h(($producto['codigo'] ?? '') . ' · ' . ($producto['nombre'] ?? '')) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-field">
        <label>Proveedor</label>
        <input name="proveedor" placeholder="Nombre del proveedor">
      </div>
      <div class="form-field">
        <label>Cantidad</label>
        <input name="cantidad" type="number" min="1" value="1" required>
      </div>
      <div class="form-field">
        <label>Coste unitario</label>
        <input name="costo_unitario" placeholder="12,50" required>
      </div>
      <div class="form-field full">
        <label>Nota</label>
        <input name="nota" placeholder="Observación interna">
      </div>
    </div>
    <div class="actions"><button class="btn btn-primary" type="submit">Registrar compra</button></div>
  </form>
</section>
<section class="admin-card">
  <div class="admin-card-header"><h2>Historial de compras</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Fecha</th><th>Producto</th><th>Proveedor</th><th>Cantidad</th><th>Unitario</th><th>Total</th></tr></thead>
      <tbody>
        <?php foreach ($compras as $compra): ?>
          <tr>
            <td><?= bd_h(date('d/m/Y H:i', strtotime($compra['created_at'] ?? 'now'))) ?></td>
            <td><strong><?= bd_h($compra['producto_nombre'] ?? '') ?></strong></td>
            <td><?= bd_h($compra['proveedor'] ?? '') ?></td>
            <td><?= (int) ($compra['cantidad'] ?? 0) ?></td>
            <td><?= bd_h(bd_format_money((float) ($compra['costo_unitario'] ?? 0))) ?></td>
            <td><strong><?= bd_h(bd_format_money((float) ($compra['total'] ?? 0))) ?></strong></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php bd_admin_footer(); ?>
