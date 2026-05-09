<?php
require_once __DIR__ . '/_helpers.php';
$_SESSION = [];
session_destroy();
bd_redirect('index.php');
