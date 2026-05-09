<?php

declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

date_default_timezone_set('America/Bogota');

const BD_DATA_DIR = __DIR__ . '/../data';
const BD_CATALOGO_FILE = BD_DATA_DIR . '/catalogo.json';
const BD_USUARIOS_FILE = BD_DATA_DIR . '/usuarios.json';
const BD_PEDIDOS_FILE = BD_DATA_DIR . '/pedidos.json';
const BD_COMPRAS_FILE = BD_DATA_DIR . '/compras.json';
const BD_ROLES_FILE = BD_DATA_DIR . '/roles.json';

function bd_ensure_data_files(): void
{
    if (!is_dir(BD_DATA_DIR)) {
        mkdir(BD_DATA_DIR, 0775, true);
    }

    if (!file_exists(BD_USUARIOS_FILE) || count(bd_read_json(BD_USUARIOS_FILE, [])) === 0) {
        bd_write_json(BD_USUARIOS_FILE, [
            [
                'id' => 1,
                'nombre' => 'Administrador Bella Dorada',
                'usuario' => 'admin',
                'email' => 'admin@belladorada.com',
                'password' => password_hash('admin123', PASSWORD_DEFAULT),
                'rol' => 'admin',
                'estado' => true,
                'created_at' => date('c'),
            ],
        ]);
    }

    if (!file_exists(BD_PEDIDOS_FILE)) {
        bd_write_json(BD_PEDIDOS_FILE, []);
    }

    if (!file_exists(BD_COMPRAS_FILE)) {
        bd_write_json(BD_COMPRAS_FILE, []);
    }

    if (!file_exists(BD_ROLES_FILE) || count(bd_read_json(BD_ROLES_FILE, [])) === 0) {
        bd_write_json(BD_ROLES_FILE, [
            ['id' => 'admin', 'nombre' => 'Administrador', 'permisos' => ['dashboard', 'productos', 'pedidos', 'compras', 'usuarios', 'roles']],
            ['id' => 'ventas', 'nombre' => 'Ventas', 'permisos' => ['dashboard', 'pedidos', 'ventas']],
            ['id' => 'inventario', 'nombre' => 'Inventario', 'permisos' => ['dashboard', 'productos', 'compras']],
        ]);
    }

    if (!file_exists(BD_CATALOGO_FILE)) {
        bd_write_json(BD_CATALOGO_FILE, [
            'config' => [
                'topbar' => 'Bella Dorada · ramos de maquillaje, detalles y regalos personalizados',
                'heroEtiqueta' => 'Catálogo especial',
                'heroTitulo' => 'Ramos de maquillaje Bella Dorada',
                'heroDescripcion' => 'Detalles únicos con maquillaje, flores, brochas, gloss, paletas y productos de cuidado personal.',
                'heroImagen' => '',
                'aboutTitulo' => 'Regalos personalizados con estilo femenino y elegante',
                'aboutTexto' => 'Bella Dorada crea ramos y boxes de maquillaje para fechas especiales.',
                'footerDescripcion' => 'Ramos de maquillaje, boxes de belleza y detalles personalizados para regalar.',
                'email' => 'Belladorada.oficial@gmail.com',
                'whatsapp' => '573185331331',
            ],
            'categorias' => [
                ['id' => 'ramos-maquillaje', 'nombre' => 'Ramos de maquillaje'],
                ['id' => 'ramos-premium', 'nombre' => 'Ramos premium'],
                ['id' => 'box-belleza', 'nombre' => 'Box de belleza'],
            ],
            'productos' => [],
        ]);
    }
}

function bd_read_json(string $file, array $default = []): array
{
    if (!file_exists($file)) {
        return $default;
    }

    $content = file_get_contents($file);
    if ($content === false || trim($content) === '') {
        return $default;
    }

    $json = json_decode($content, true);
    return is_array($json) ? $json : $default;
}

function bd_write_json(string $file, array $data): bool
{
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    return file_put_contents($file, $json . PHP_EOL, LOCK_EX) !== false;
}

function bd_h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function bd_redirect(string $url): never
{
    header('Location: ' . $url);
    exit;
}

function bd_current_user(): ?array
{
    return $_SESSION['bd_user'] ?? null;
}

function bd_require_login(): void
{
    if (!bd_current_user()) {
        bd_redirect('index.php');
    }
}

function bd_flash(?string $message = null, string $type = 'success'): ?array
{
    if ($message !== null) {
        $_SESSION['bd_flash'] = ['message' => $message, 'type' => $type];
        return null;
    }

    $flash = $_SESSION['bd_flash'] ?? null;
    unset($_SESSION['bd_flash']);
    return $flash;
}

function bd_catalogo(): array
{
    $catalogo = bd_read_json(BD_CATALOGO_FILE, []);
    $catalogo['config'] = $catalogo['config'] ?? [];
    $catalogo['categorias'] = is_array($catalogo['categorias'] ?? null) ? $catalogo['categorias'] : [];
    $catalogo['productos'] = is_array($catalogo['productos'] ?? null) ? $catalogo['productos'] : [];

    foreach ($catalogo['productos'] as &$producto) {
        $producto['stock'] = (int) ($producto['stock'] ?? 0);
        $producto['estado'] = $producto['estado'] ?? true;
        $producto['destacado'] = $producto['destacado'] ?? false;
    }
    unset($producto);

    return $catalogo;
}

function bd_save_catalogo(array $catalogo): bool
{
    $catalogo['config'] = $catalogo['config'] ?? [];
    $catalogo['categorias'] = array_values($catalogo['categorias'] ?? []);
    $catalogo['productos'] = array_values($catalogo['productos'] ?? []);
    return bd_write_json(BD_CATALOGO_FILE, $catalogo);
}

function bd_price_to_float(mixed $value): float
{
    if (is_numeric($value)) {
        return (float) $value;
    }

    $text = (string) $value;
    $text = str_replace('.', '', $text);
    $text = str_replace(',', '.', $text);

    if (preg_match('/\d+(\.\d+)?/', $text, $match)) {
        return (float) $match[0];
    }

    return 0.0;
}

function bd_format_money(float $value): string
{
    return number_format($value, 2, ',', '.') . ' €';
}

function bd_next_id(array $items): int
{
    $max = 0;
    foreach ($items as $item) {
        $max = max($max, (int) ($item['id'] ?? 0));
    }
    return $max + 1;
}

function bd_find_product(array $catalogo, int|string $id): ?array
{
    foreach ($catalogo['productos'] ?? [] as $producto) {
        if ((string) ($producto['id'] ?? '') === (string) $id) {
            return $producto;
        }
    }
    return null;
}

function bd_update_product_stock(int|string $productId, int $qtyChange): void
{
    $catalogo = bd_catalogo();
    foreach ($catalogo['productos'] as &$producto) {
        if ((string) ($producto['id'] ?? '') === (string) $productId) {
            $producto['stock'] = max(0, (int) ($producto['stock'] ?? 0) + $qtyChange);
            break;
        }
    }
    unset($producto);
    bd_save_catalogo($catalogo);
}

function bd_stats(): array
{
    $catalogo = bd_catalogo();
    $pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
    $compras = bd_read_json(BD_COMPRAS_FILE, []);
    $usuarios = bd_read_json(BD_USUARIOS_FILE, []);

    $productosActivos = array_filter($catalogo['productos'], fn ($p) => ($p['estado'] ?? true) !== false);
    $stockTotal = array_sum(array_map(fn ($p) => (int) ($p['stock'] ?? 0), $productosActivos));
    $stockBajo = count(array_filter($productosActivos, fn ($p) => (int) ($p['stock'] ?? 0) <= 3));

    $ventasTotal = 0.0;
    $pedidosPendientes = 0;
    $pedidosConfirmados = 0;

    foreach ($pedidos as $pedido) {
        $estado = $pedido['estado'] ?? 'pendiente';
        if ($estado === 'pendiente') {
            $pedidosPendientes++;
        }
        if (in_array($estado, ['confirmado', 'entregado'], true)) {
            $pedidosConfirmados++;
            $ventasTotal += (float) ($pedido['total'] ?? 0);
        }
    }

    $comprasTotal = array_sum(array_map(fn ($c) => (float) ($c['total'] ?? 0), $compras));

    return [
        'productos' => count($productosActivos),
        'stock_total' => $stockTotal,
        'stock_bajo' => $stockBajo,
        'pedidos' => count($pedidos),
        'pedidos_pendientes' => $pedidosPendientes,
        'pedidos_confirmados' => $pedidosConfirmados,
        'ventas_total' => $ventasTotal,
        'compras_total' => $comprasTotal,
        'usuarios' => count(array_filter($usuarios, fn ($u) => ($u['estado'] ?? true) !== false)),
    ];
}

function bd_admin_header(string $title, string $active = ''): void
{
    $user = bd_current_user();
    $flash = bd_flash();
    ?>
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title><?= bd_h($title) ?> | Admin Bella Dorada</title>
      <link rel="stylesheet" href="assets/admin.css">
    </head>

    <body class="admin-sidebar-collapsed">

      <div class="admin-sidebar-overlay" data-admin-menu-close></div>

      <aside class="admin-sidebar" data-admin-sidebar>
        <div class="admin-sidebar-head">
          <a class="admin-brand" href="dashboard.php">
            <span>BD</span>
            <strong>Bella Dorada</strong>
          </a>

          <button type="button" class="admin-sidebar-close" data-admin-menu-close aria-label="Cerrar menú">
            ×
          </button>
        </div>

        <nav>
          <a class="<?= $active === 'dashboard' ? 'active' : '' ?>" href="dashboard.php">Dashboard</a>
          <a class="<?= $active === 'productos' ? 'active' : '' ?>" href="productos.php">Ramos full</a>
          <a class="<?= $active === 'productos_individuales' ? 'active' : '' ?>" href="productos_individuales.php">Productos individuales</a>
          <a class="<?= $active === 'presentaciones' ? 'active' : '' ?>" href="presentaciones_personalizadas.php">Presentacione ramos</a>
          <a class="<?= $active === 'categorias' ? 'active' : '' ?>" href="categorias.php">Categorías produtos</a>
          <?php /*
            <a class="<?= $active === 'ventas' ? 'active' : '' ?>" href="ventas.php">Ventas</a>
            <a class="<?= $active === 'pedidos' ? 'active' : '' ?>" href="pedidos.php">Pedidos</a>
            <a class="<?= $active === 'compras' ? 'active' : '' ?>" href="compras.php">Compras</a>
            */ ?>
          <a class="<?= $active === 'usuarios' ? 'active' : '' ?>" href="usuarios.php">Usuarios</a>
          <a class="<?= $active === 'roles' ? 'active' : '' ?>" href="roles.php">Roles</a>
          <a href="../index.html" target="_blank">Ver web</a>
        </nav>
      </aside>

      <main class="admin-main">
        <header class="admin-topbar">
          <div class="admin-topbar-left">
            <button type="button" class="admin-menu-toggle" data-admin-menu-toggle aria-label="Abrir menú">
              <span></span>
              <span></span>
              <span></span>
            </button>

            <div>
              <p>Panel administrativo</p>
              <h1><?= bd_h($title) ?></h1>
            </div>
          </div>

          <div class="admin-user">
            <span><?= bd_h($user['nombre'] ?? 'Usuario') ?></span>
            <a href="logout.php">Salir</a>
          </div>
        </header>

        <?php if ($flash): ?>
          <div class="alert <?= bd_h($flash['type']) ?>"><?= bd_h($flash['message']) ?></div>
        <?php endif; ?>
    <?php
}

function bd_admin_footer(): void
{
    ?>
      </main>

      <script>
        document.addEventListener('DOMContentLoaded', function () {
          const body = document.body;
          const openButton = document.querySelector('[data-admin-menu-toggle]');
          const closeButtons = document.querySelectorAll('[data-admin-menu-close]');
          const sidebarLinks = document.querySelectorAll('.admin-sidebar nav a');

          function openMenu() {
            body.classList.add('admin-sidebar-open');
            body.classList.remove('admin-sidebar-collapsed');
          }

          function closeMenu() {
            body.classList.remove('admin-sidebar-open');
            body.classList.add('admin-sidebar-collapsed');
          }

          if (openButton) {
            openButton.addEventListener('click', function () {
              if (body.classList.contains('admin-sidebar-open')) {
                closeMenu();
              } else {
                openMenu();
              }
            });
          }

          closeButtons.forEach(function (button) {
            button.addEventListener('click', closeMenu);
          });

          sidebarLinks.forEach(function (link) {
            link.addEventListener('click', function () {
              if (window.innerWidth <= 980) {
                closeMenu();
              }
            });
          });

          document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
              closeMenu();
            }
          });
        });
      </script>
    </body>
    </html>
    <?php
}

bd_ensure_data_files();
