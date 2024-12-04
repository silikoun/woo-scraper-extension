<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Simple test response
echo json_encode([
    'status' => 'success',
    'message' => 'Connection successful',
    'received_data' => $_POST ?: json_decode(file_get_contents('php://input'), true)
]);
