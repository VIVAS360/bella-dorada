<?php
require_once __DIR__ . '/productos_base.php';

bd_render_productos_admin([
    'active' => 'productos_individuales',
    'titulo' => 'Productos individuales',
    'subtitulo' => 'Productos de belleza y varios vendidos por unidad',
    'tipo_producto' => 'individual',
    'nombre_boton' => 'Guardar producto individual',
    'nuevo_titulo' => 'Nuevo producto individual',
    'editar_titulo' => 'Editar producto individual',
]);