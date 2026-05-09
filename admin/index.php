<?php
require_once __DIR__ . '/_helpers.php';

if (bd_current_user()) {
    bd_redirect('dashboard.php');
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $usuario = trim($_POST['usuario'] ?? '');
    $password = (string) ($_POST['password'] ?? '');
    $usuarios = bd_read_json(BD_USUARIOS_FILE, []);

    foreach ($usuarios as $user) {
        if (($user['estado'] ?? true) && strtolower($user['usuario'] ?? '') === strtolower($usuario) && password_verify($password, $user['password'] ?? '')) {
            unset($user['password']);
            $_SESSION['bd_user'] = $user;
            bd_redirect('dashboard.php');
        }
    }

    $error = 'Usuario o contraseña incorrectos.';
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login | Admin Bella Dorada</title>
  <link rel="stylesheet" href="assets/admin.css">
</head>
<body class="login-body">
  <form class="login-card" method="post" autocomplete="off">
    <a class="admin-brand" href="index.php">
      <span>BD</span>
      <strong>Bella Dorada</strong>
    </a>
    <h1>Acceso administrativo</h1>
    <p>Gestiona ventas, pedidos, productos, stock y usuarios.</p>

    <?php if ($error): ?>
      <div class="alert error"><?= bd_h($error) ?></div>
    <?php endif; ?>

    <div class="form-field">
      <label for="usuario">Usuario</label>
      <input id="usuario" name="usuario" type="text" required autofocus>
    </div>

    <div class="form-field" style="margin-top: 12px;">
      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" required>
    </div>

    <div class="actions">
      <button class="btn btn-primary" type="submit" style="width: 100%;">Entrar</button>
    </div>

    <div class="login-help">
    </div>
  </form>
</body>
</html>
