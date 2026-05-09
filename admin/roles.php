<?php
require_once __DIR__ . '/_helpers.php';
bd_require_login();
$roles = bd_read_json(BD_ROLES_FILE, []);
bd_admin_header('Roles', 'roles');
?>
<section class="admin-card">
  <div class="admin-card-header"><h2>Roles del sistema</h2></div>
  <p>Los roles se guardan en <code>data/roles.json</code>. En esta primera versión quedan definidos para organizar permisos y usuarios.</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Rol</th><th>ID</th><th>Permisos</th></tr></thead>
      <tbody>
        <?php foreach ($roles as $rol): ?>
          <tr>
            <td><strong><?= bd_h($rol['nombre'] ?? '') ?></strong></td>
            <td><?= bd_h($rol['id'] ?? '') ?></td>
            <td><?= bd_h(implode(', ', $rol['permisos'] ?? [])) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php bd_admin_footer(); ?>
