<?php
require 'vendor/autoload.php';
session_start();

use Dotenv\Dotenv;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Update CORS headers to allow all origins during development
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');  // Allow all origins during development
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400'); // 24 hours cache

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

function generateToken($userId, $email) {
    $issuedAt = time();
    $expirationTime = $issuedAt + 30 * 24 * 60 * 60; // 30 days

    $payload = [
        'iss' => 'woo-scraper',
        'aud' => 'chrome-extension',
        'iat' => $issuedAt,
        'exp' => $expirationTime,
        'user_id' => $userId,
        'email' => $email
    ];

    return JWT::encode($payload, $_ENV['SUPABASE_JWT_SECRET'], 'HS256');
}

function validateToken($token) {
    try {
        $decoded = JWT::decode($token, new Key($_ENV['SUPABASE_JWT_SECRET'], 'HS256'));
        return [
            'valid' => true,
            'user' => [
                'id' => $decoded->user_id,
                'email' => $decoded->email
            ]
        ];
    } catch (Exception $e) {
        return [
            'valid' => false,
            'error' => $e->getMessage()
        ];
    }
}

// Rate limiting implementation
function checkRateLimit($ip) {
    $rateFile = __DIR__ . '/rate_limits.json';
    $limits = [];
    
    if (file_exists($rateFile)) {
        $limits = json_decode(file_get_contents($rateFile), true);
    }
    
    $now = time();
    $windowSize = 3600; // 1 hour
    $maxAttempts = 100;
    
    // Clean old entries
    foreach ($limits as $key => $data) {
        if ($data['timestamp'] < ($now - $windowSize)) {
            unset($limits[$key]);
        }
    }
    
    if (!isset($limits[$ip])) {
        $limits[$ip] = [
            'attempts' => 1,
            'timestamp' => $now
        ];
    } else {
        $limits[$ip]['attempts']++;
    }
    
    file_put_contents($rateFile, json_encode($limits));
    
    return $limits[$ip]['attempts'] <= $maxAttempts;
}

function refreshToken($token) {
    try {
        $decoded = JWT::decode($token, new Key($_ENV['SUPABASE_JWT_SECRET'], 'HS256'));
        
        // Check if token is close to expiration (within 5 days)
        if ($decoded->exp - time() < 5 * 24 * 60 * 60) {
            return generateToken($decoded->user_id, $decoded->email);
        }
        
        return $token;
    } catch (Exception $e) {
        return null;
    }
}

function logSecurityEvent($event, $details) {
    $logFile = __DIR__ . '/security.log';
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = sprintf("[%s] %s: %s\n", $timestamp, $event, json_encode($details));
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    $action = $data['action'] ?? '';

    // Check rate limit
    if (!checkRateLimit($_SERVER['REMOTE_ADDR'])) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many requests. Please try again later.']);
        logSecurityEvent('RATE_LIMIT_EXCEEDED', ['ip' => $_SERVER['REMOTE_ADDR']]);
        exit;
    }

    switch ($action) {
        case 'generate':
            if (!isset($_SESSION['user'])) {
                http_response_code(401);
                logSecurityEvent('UNAUTHORIZED_TOKEN_GENERATION', ['ip' => $_SERVER['REMOTE_ADDR']]);
                echo json_encode([
                    'error' => 'Unauthorized',
                    'message' => 'Please log in to generate a token'
                ]);
                exit;
            }
            $token = generateToken($_SESSION['user']['id'], $_SESSION['user']['email']);
            logSecurityEvent('TOKEN_GENERATED', ['user_id' => $_SESSION['user']['id']]);
            echo json_encode([
                'success' => true,
                'token' => $token
            ]);
            break;

        case 'validate':
            $token = $data['token'] ?? '';
            if (empty($token)) {
                http_response_code(400);
                echo json_encode([
                    'error' => 'Token is required',
                    'message' => 'Please provide a valid token'
                ]);
                exit;
            }
            
            $result = validateToken($token);
            if ($result['valid']) {
                // Check if token needs refresh
                $newToken = refreshToken($token);
                if ($newToken && $newToken !== $token) {
                    $result['new_token'] = $newToken;
                    $result['message'] = 'Token refreshed due to approaching expiration';
                }
                logSecurityEvent('TOKEN_VALIDATED', ['user_id' => $result['user']['id']]);
            } else {
                logSecurityEvent('TOKEN_VALIDATION_FAILED', ['error' => $result['error']]);
            }
            echo json_encode($result);
            break;

        case 'refresh':
            $token = $data['token'] ?? '';
            if (empty($token)) {
                http_response_code(400);
                echo json_encode([
                    'error' => 'Token is required',
                    'message' => 'Please provide a valid token to refresh'
                ]);
                exit;
            }
            
            $newToken = refreshToken($token);
            if ($newToken) {
                logSecurityEvent('TOKEN_REFRESHED', ['old_token_valid' => true]);
                echo json_encode([
                    'success' => true,
                    'token' => $newToken
                ]);
            } else {
                logSecurityEvent('TOKEN_REFRESH_FAILED', ['old_token_valid' => false]);
                http_response_code(400);
                echo json_encode([
                    'error' => 'Invalid token',
                    'message' => 'Unable to refresh invalid token'
                ]);
            }
            break;

        default:
            http_response_code(400);
            echo json_encode([
                'error' => 'Invalid action',
                'message' => 'Supported actions are: generate, validate, refresh'
            ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method not allowed',
        'message' => 'Only POST requests are supported'
    ]);
}
