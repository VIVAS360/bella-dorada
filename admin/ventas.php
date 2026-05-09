<?php
require_once __DIR__ . '/_helpers.php';
bd_require_login();
$pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
$ventas = array_values(array_filter($pedidos, fn ($p) => in_array($p['estado'] ?? '', ['confirmado', 'entregado'], true)));
$total = array_sum(array_map(fn ($p) => (float) ($p['total'] ?? 0), $ventas));
bd_admin_header('Ventas', 'ventas');
?>
<section class="stats-grid">
  <article class="stat-card"><small>Total vendido</small><strong><?= bd_h(bd_format_money($total)) ?></strong></article>
  <article class="stat-card"><small>Ventas confirmadas</small><strong><?= count($ventas) ?></strong></article>
</section>
<section class="admin-card">
  <div class="admin-card-header"><h2>Ventas confirmadas o entregadas</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead>
      <tbody>
        <?php foreach ($ventas as $venta): ?>
          <tr>
            <td><strong><?= bd_h($venta['id'] ?? '') ?></strong></td>
            <td><?= bd_h(date('d/m/Y H:i', strtotime($venta['created_at'] ?? 'now'))) ?></td>
            <td><span class="status ok"><?= bd_h($venta['estado'] ?? '') ?></span></td>
            <td><strong><?= bd_h(bd_format_money((float) ($venta['total'] ?? 0))) ?></strong></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php bd_admin_footer(); ?>
