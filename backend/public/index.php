<?php
declare(strict_types=1);

use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

// Load environment variables
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

// Map Railway MySQL addon vars to DB_* (when not already set)
if (getenv('MYSQLHOST') && !getenv('DB_HOST')) {
    $_ENV['DB_HOST'] = getenv('MYSQLHOST');
    $_ENV['DB_PORT'] = getenv('MYSQLPORT') ?: '3306';
    $_ENV['DB_USER'] = getenv('MYSQLUSER');
    $_ENV['DB_PASS'] = getenv('MYSQLPASSWORD');
    $_ENV['DB_NAME'] = getenv('MYSQLDATABASE');
}

// Create Slim app
$app = AppFactory::create();

// Add error middleware
$app->addErrorMiddleware(true, true, true);

// Add CORS middleware for frontend communication - use * for better flexibility
$app->add(function ($request, $handler) {
    // For OPTIONS requests, handle them immediately with appropriate CORS headers
    if ($request->getMethod() === 'OPTIONS') {
        $response = new \Slim\Psr7\Response();
        return $response
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Max-Age', '86400')
            ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
    }
    
    // For all other requests, add CORS headers to the response
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
});

// We'll handle OPTIONS requests in the middleware instead of here
// Removing this route to avoid conflicts with specific route handlers

// Root route - API documentation
$app->get('/', function ($request, $response, $args) {
    $html = '
    <!DOCTYPE html>
    <html>
    <head>
        <title>Square Dance Club API</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .endpoint { background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 4px; }
            .method { color: #0066cc; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>Square Dance Club Management API</h1>
        <p>API is running successfully! Here are the available endpoints:</p>
        
        <h2>System Endpoints</h2>
        <div class="endpoint"><span class="method">GET</span> <a href="/api/test">/api/test</a> - Basic API test</div>
        <div class="endpoint"><span class="method">GET</span> <a href="/api/health">/api/health</a> - Health check</div>
        <div class="endpoint"><span class="method">GET</span> <a href="/api/db-test">/api/db-test</a> - Database connection test</div>
        <div class="endpoint"><span class="method">GET</span> <a href="/api/status">/api/status</a> - Complete API status</div>
        <div class="endpoint"><span class="method">GET</span> <a href="/test-download.csv">/test-download.csv</a> - Test CSV download</div>
        
        <h2>Authentication</h2>
        <div class="endpoint"><span class="method">POST</span> /api/auth/send-login-link - Send passwordless login link</div>
        <div class="endpoint"><span class="method">POST</span> /api/auth/validate-token - Validate token and get JWT</div>
        
        <h2>User Management</h2>
        <div class="endpoint"><span class="method">GET</span> <a href="/api/users">/api/users</a> - Get all users</div>
        <div class="endpoint"><span class="method">GET</span> /api/users/{id} - Get specific user</div>
        
        <h2>Settings</h2>
        <div class="endpoint"><span class="method">GET</span> <a href="/api/settings">/api/settings</a> - Get all settings</div>
        <div class="endpoint"><span class="method">GET</span> /api/settings/{key} - Get specific setting</div>
        
        <h2>Frontend Application</h2>
        <p><a href="http://localhost:5175" target="_blank">Open React Frontend →</a></p>
        
        <hr>
        <p><small>Square Dance Club Management System v1.0.0</small></p>
    </body>
    </html>
    ';
    
    $response->getBody()->write($html);
    return $response->withHeader('Content-Type', 'text/html');
});

// Test download route - no authentication required
$app->get('/test-download.csv', function ($request, $response, $args) {
    // Simple CSV content
    $csvContent = "id,name,value\n1,test,data\n2,sample,content\n";
    
    // Log access for debugging
    error_log("Test download accessed");
    
    // Set minimal headers
    $response = $response
        ->withHeader('Content-Type', 'text/csv')
        ->withHeader('Content-Disposition', 'attachment; filename=test-download.csv')
        ->withHeader('Content-Length', strlen($csvContent));
    
    // Write content and return
    $response->getBody()->write($csvContent);
    return $response;
});

// Basic test route
$app->get('/api/test', function ($request, $response, $args) {
    $data = [
        'message' => 'Backend API is working!',
        'timestamp' => date('Y-m-d H:i:s'),
        'php_version' => PHP_VERSION,
        'status' => 'success'
    ];
    
    $response->getBody()->write(json_encode($data));
    return $response->withHeader('Content-Type', 'application/json');
});

// Health check route
$app->get('/api/health', function ($request, $response, $args) {
    $data = [
        'status' => 'healthy',
        'timestamp' => date('c'),
        'version' => '1.0.0'
    ];
    
    $response->getBody()->write(json_encode($data));
    return $response->withHeader('Content-Type', 'application/json');
});

// Database test route
$app->get('/api/db-test', function ($request, $response, $args) {
    $data = \App\Database::testConnection();
    
    $response->getBody()->write(json_encode($data));
    return $response->withHeader('Content-Type', 'application/json');
});

// API Status route - shows all available endpoints
$app->get('/api/status', function ($request, $response, $args) {
    $data = [
        'status' => 'operational',
        'version' => '1.0.0',
        'timestamp' => date('c'),
        'database' => \App\Database::testConnection(),
        'endpoints' => [
            'GET /api/test' => 'Basic API test',
            'GET /api/health' => 'Health check',
            'GET /api/db-test' => 'Database connection test',
            'GET /api/status' => 'API status and endpoints',
            'POST /api/auth/send-login-link' => 'Send passwordless login link',
            'POST /api/auth/validate-token' => 'Validate login token and get JWT',
            'GET /api/users' => 'Get all users with relationships',
            'GET /api/users/{id}' => 'Get specific user by ID',
            'GET /api/settings' => 'Get all club settings',
            'GET /api/settings/{key}' => 'Get specific setting by key'
        ],
        'features_implemented' => [
            'Database connection (SQLite)',
            'User management with relationships',
            'Club settings management',
            'RESTful API design',
            'Error handling',
            'Standardized responses'
        ]
    ];
    
    $response->getBody()->write(json_encode($data, JSON_PRETTY_PRINT));
    return $response->withHeader('Content-Type', 'application/json');
});

// Include route files
require_once __DIR__ . '/../src/routes/auth.php';
require_once __DIR__ . '/../src/routes/users.php';
require_once __DIR__ . '/../src/routes/settings.php';
require_once __DIR__ . '/../src/routes/schedules.php';
require_once __DIR__ . '/../src/routes/cron.php';
require_once __DIR__ . '/../src/routes/maintenance.php';
require_once __DIR__ . '/../src/routes/email.php';

$app->run();
