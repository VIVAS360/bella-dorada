<?php
require_once __DIR__ . '/_helpers.php';
bd_require_login();

$pedidos = bd_read_json(BD_PEDIDOS_FILE, []);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pedidoId = $_POST['pedido_id'] ?? '';
    $nuevoEstado = $_POST['estado'] ?? 'pendiente';

    foreach ($pedidos as &$pedido) {
        if (($pedido['id'] ?? '') === $pedidoId) {
            $estadoAnterior = $pedido['estado'] ?? 'pendiente';
            $pedido['estado'] = $nuevoEstado;
            $pedido['updated_at'] = date('c');

            if (in_array($nuevoEstado, ['confirmado', 'entregado'], true) && empty($pedido['stock_descontado'])) {
                foreach ($pedido['items'] ?? [] as $item) {
                    bd_update_product_stock($item['producto_id'] ?? 0, -((int) ($item['cantidad'] ?? 0)));
                }
                $pedido['stock_descontado'] = true;
            }

            if ($nuevoEstado === 'cancelado' && !empty($pedido['stock_descontado'])) {
                foreach ($pedido['items'] ?? [] as $item) {
                    bd_update_product_stock($item['producto_id'] ?? 0, (int) ($item['cantidad'] ?? 0));
                }
                $pedido['stock_descontado'] = false;
            }

            break;
        }
    }
    unset($pedido);

    bd_write_json(BD_PEDIDOS_FILE, $pedidos);
    bd_flash('Estado del pedido actualizado.');
    bd_redirect('pedidos.php');
}

usort($pedidos, fn ($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

bd_admin_header('Pedidos', 'pedidos');
?>
<section class="admin-card">
  <div class="admin-card-header"><h2>Pedidos recibidos desde la web</h2></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Fecha</th>
          <th>Productos</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($pedidos as $pedido): ?>
          <tr>
            <td><strong><?= bd_h($pedido['id'] ?? '') ?></strong><small><?= bd_h($pedido['origen'] ?? 'web') ?></small></td>
            <td><?= bd_h(date('d/m/Y H:i', strtotime($pedido['created_at'] ?? 'now'))) ?></td>
            <td>
              <?php foreach (($pedido['items'] ?? []) as $item): ?>
                <div><?= (int) ($item['cantidad'] ?? 0) ?> × <?= bd_h($item['nombre'] ?? '') ?></div>
              <?php endforeach; ?>
            </td>
            <td><strong><?= bd_h(bd_format_money((float) ($pedido['total'] ?? 0))) ?></strong></td>
            <td><span class="status <?= (($pedido['estado'] ?? '') === 'cancelado') ? 'bad' : ((($pedido['estado'] ?? '') === 'pendiente') ? 'warn' : 'ok') ?>"><?= bd_h($pedido['estado'] ?? 'pendiente') ?></span></td>
            <td>
              <form method="post" style="display:flex; gap:8px; align-items:center;">
                <input type="hidden" name="pedido_id" value="<?= bd_h($pedido['id'] ?? '') ?>">
                <select name="estado">
                  <?php foreach (['pendiente', 'confirmado', 'entregado', 'cancelado'] as $estado): ?>
                    <option value="<?= $estado ?>" <?= (($pedido['estado'] ?? 'pendiente') === $estado) ? 'selected' : '' ?>><?= $estado ?></option>
                  <?php endforeach; ?>
                </select>
                <button class="btn btn-primary" type="submit">Guardar</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php bd_admin_footer(); ?>
