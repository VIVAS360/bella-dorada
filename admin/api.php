<?php
require_once __DIR__ . '/_helpers.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

try {
    if ($action !== 'crear_pedido') {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'Acción no encontrada'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'message' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        throw new RuntimeException('JSON inválido.');
    }

    $itemsPayload = $payload['items'] ?? [];
    if (!is_array($itemsPayload) || count($itemsPayload) === 0) {
        throw new RuntimeException('El pedido no tiene productos.');
    }

    $catalogo = bd_catalogo();
    $items = [];
    $total = 0.0;

    foreach ($itemsPayload as $item) {
        $productoId = $item['producto_id'] ?? $item['id'] ?? null;
        $cantidad = max(1, (int) ($item['cantidad'] ?? 1));
        $producto = bd_find_product($catalogo, (string) $productoId);

        if (!$producto || (($producto['estado'] ?? true) === false)) {
            continue;
        }

        $precio = bd_price_to_float($producto['precio'] ?? 0);
        $subtotal = $precio * $cantidad;
        $total += $subtotal;

        $items[] = [
            'producto_id' => $producto['id'],
            'codigo' => $producto['codigo'] ?? '',
            'nombre' => $producto['nombre'] ?? '',
            'cantidad' => $cantidad,
            'precio_unitario' => $precio,
            'subtotal' => $subtotal,
        ];
    }

    if (!$items) {
        throw new RuntimeException('No se pudo validar ningún producto del pedido.');
    }

    $pedidos = bd_read_json(BD_PEDIDOS_FILE, []);
    $pedidoId = 'BD-' . date('Ymd-His') . '-' . random_int(100, 999);

    $pedido = [
        'id' => $pedidoId,
        'origen' => 'web-whatsapp',
        'cliente' => [
            'nombre' => trim($payload['cliente']['nombre'] ?? 'Cliente WhatsApp'),
            'telefono' => trim($payload['cliente']['telefono'] ?? ''),
            'nota' => trim($payload['cliente']['nota'] ?? ''),
        ],
        'items' => $items,
        'total' => $total,
        'estado' => 'pendiente',
        'stock_descontado' => false,
        'created_at' => date('c'),
        'updated_at' => date('c'),
    ];

    $pedidos[] = $pedido;
    bd_write_json(BD_PEDIDOS_FILE, $pedidos);

    echo json_encode(['ok' => true, 'pedido_id' => $pedidoId, 'pedido' => $pedido], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
