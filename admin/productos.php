<?php
require_once __DIR__ . '/productos_base.php';

bd_render_productos_admin([
    'active' => 'productos',
    'titulo' => 'Ramos full',
    'subtitulo' => 'Ramos completos de maquillaje y regalos personalizados',
    'tipo_producto' => 'ramos_full',
    'nombre_boton' => 'Guardar ramo full',
    'nuevo_titulo' => 'Nuevo ramo full',
    'editar_titulo' => 'Editar ramo full',
]);