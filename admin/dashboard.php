<?php
require_once __DIR__ . '/_helpers.php';
bd_require_login();
$stats = bd_stats();
bd_admin_header('Dashboard', 'dashboard');
?>
<section class="stats-grid">
  <article class="stat-card"><small>Ventas confirmadas</small><strong><?= bd_h(bd_format_money($stats['ventas_total'])) ?></strong></article>
  <article class="stat-card"><small>Pedidos pendientes</small><strong><?= (int) $stats['pedidos_pendientes'] ?></strong></article>
  <article class="stat-card"><small>Productos activos</small><strong><?= (int) $stats['productos'] ?></strong></article>
  <article class="stat-card"><small>Stock total</small><strong><?= (int) $stats['stock_total'] ?></strong></article>
  <article class="stat-card"><small>Stock bajo</small><strong><?= (int) $stats['stock_bajo'] ?></strong></article>
  <article class="stat-card"><small>Compras registradas</small><strong><?= bd_h(bd_format_money($stats['compras_total'])) ?></strong></article>
  <article class="stat-card"><small>Pedidos totales</small><strong><?= (int) $stats['pedidos'] ?></strong></article>
  <article class="stat-card"><small>Usuarios activos</small><strong><?= (int) $stats['usuarios'] ?></strong></article>
</section>

<section class="admin-card">
  <div class="admin-card-header">
    <h2>Flujo recomendado</h2>
  </div>
  <p>El cliente agrega productos al carrito y envía el pedido por WhatsApp. Antes de abrir WhatsApp, la web registra el pedido en <code>data/pedidos.json</code>. Desde este panel puedes confirmar el pedido y descontar stock.</p>
  <div class="actions">
    <a class="btn btn-primary" href="pedidos.php">Revisar pedidos</a>
    <a class="btn btn-soft" href="productos.php">Gestionar productos</a>
    <a class="btn btn-soft" href="compras.php">Registrar compras</a>
  </div>
</section>
<?php bd_admin_footer(); ?>
