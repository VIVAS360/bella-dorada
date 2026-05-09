<?php
require_once __DIR__ . '/_helpers.php';
bd_require_login();

$usuarios = bd_read_json(BD_USUARIOS_FILE, []);
$roles = bd_read_json(BD_ROLES_FILE, []);

if (isset($_GET['desactivar'])) {
    foreach ($usuarios as &$usuario) {
        if ((string) ($usuario['id'] ?? '') === (string) $_GET['desactivar']) {
            $usuario['estado'] = false;
            break;
        }
    }
    unset($usuario);
    bd_write_json(BD_USUARIOS_FILE, $usuarios);
    bd_flash('Usuario desactivado.');
    bd_redirect('usuarios.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string) ($_POST['password'] ?? '');
    if (strlen($password) < 6) {
        bd_flash('La contraseña debe tener mínimo 6 caracteres.', 'error');
        bd_redirect('usuarios.php');
    }

    $usuarios[] = [
        'id' => bd_next_id($usuarios),
        'nombre' => trim($_POST['nombre'] ?? ''),
        'usuario' => trim($_POST['usuario'] ?? ''),
        'email' => trim($_POST['email'] ?? ''),
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'rol' => trim($_POST['rol'] ?? 'ventas'),
        'estado' => true,
        'created_at' => date('c'),
    ];

    bd_write_json(BD_USUARIOS_FILE, $usuarios);
    bd_flash('Usuario creado correctamente.');
    bd_redirect('usuarios.php');
}

bd_admin_header('Usuarios', 'usuarios');
?>
<section class="admin-card">
  <div class="admin-card-header"><h2>Crear usuario</h2></div>
  <form method="post">
    <div class="form-grid three">
      <div class="form-field"><label>Nombre</label><input name="nombre" required></div>
      <div class="form-field"><label>Usuario</label><input name="usuario" required></div>
      <div class="form-field"><label>Email</label><input name="email" type="email"></div>
      <div class="form-field"><label>Contraseña</label><input name="password" type="password" required></div>
      <div class="form-field">
        <label>Rol</label>
        <select name="rol">
          <?php foreach ($roles as $rol): ?>
            <option value="<?= bd_h($rol['id']) ?>"><?= bd_h($rol['nombre']) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>
    <div class="actions"><button class="btn btn-primary" type="submit">Crear usuario</button></div>
  </form>
</section>
<section class="admin-card">
  <div class="admin-card-header"><h2>Usuarios existentes</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Nombre</th><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>
      <?php foreach ($usuarios as $usuario): ?>
        <tr>
          <td><strong><?= bd_h($usuario['nombre'] ?? '') ?></strong></td>
          <td><?= bd_h($usuario['usuario'] ?? '') ?></td>
          <td><?= bd_h($usuario['email'] ?? '') ?></td>
          <td><span class="status"><?= bd_h($usuario['rol'] ?? '') ?></span></td>
          <td><span class="status <?= (($usuario['estado'] ?? true) !== false) ? 'ok' : 'bad' ?>"><?= (($usuario['estado'] ?? true) !== false) ? 'Activo' : 'Inactivo' ?></span></td>
          <td><a class="btn btn-danger" href="usuarios.php?desactivar=<?= (int) $usuario['id'] ?>" onclick="return confirm('¿Desactivar usuario?')">Desactivar</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php bd_admin_footer(); ?>
