# SPANA Backend Data Population Test
Write-Host "🚀 Starting SPANA Backend Data Population Test..." -ForegroundColor Green

$baseUrl = "http://localhost:5003"
$headers = @{ "Content-Type" = "application/json" }

# Login all users
Write-Host "`n📝 Step 1: Login All Users" -ForegroundColor Yellow

$users = @(
    @{ email = "xolinxiweni@gmail.com"; password = "TestPassword123!"; role = "customer" },
    @{ email = "xoli@spana.co.za"; password = "TestPassword123!"; role = "service_provider" },
    @{ email = "nhlakanipho@spana.co.za"; password = "TestPassword123!"; role = "service_provider" }
)

$tokens = @{}
foreach ($user in $users) {
    $loginBody = @{
        email = $user.email
        password = $user.password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -Headers $headers -UseBasicParsing
        $loginData = $response.Content | ConvertFrom-Json
        $tokens[$user.email] = $loginData.token
        Write-Host "✅ Login successful for $($user.email)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Login failed for $($user.email)" -ForegroundColor Red
    }
}

# Test service creation
Write-Host "`n📝 Step 2: Create Services" -ForegroundColor Yellow

$xoliToken = $tokens["xoli@spana.co.za"]
$xoliHeaders = @{ "Authorization" = "Bearer $xoliToken"; "Content-Type" = "application/json" }

$services = @(
    @{
        title = "House Cleaning Service"
        description = "Professional house cleaning service for residential properties"
        category = "Cleaning"
        price = 150.00
        duration = 120
    },
    @{
        title = "Office Cleaning"
        description = "Commercial office cleaning service"
        category = "Cleaning"
        price = 200.00
        duration = 180
    }
)

foreach ($service in $services) {
    $serviceBody = $service | ConvertTo-Json
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/services" -Method POST -Body $serviceBody -Headers $xoliHeaders -UseBasicParsing
        Write-Host "✅ Created service: $($service.title)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create service $($service.title): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test getting services
Write-Host "`n📝 Step 3: Get All Services" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/services" -Method GET -UseBasicParsing
    $services = $response.Content | ConvertFrom-Json
    Write-Host "✅ Retrieved $($services.Count) services" -ForegroundColor Green
    foreach ($service in $services) {
        Write-Host "   - $($service.title) - R$($service.price)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Failed to retrieve services: $($_.Exception.Message)" -ForegroundColor Red
}

# Test booking creation
Write-Host "`n📝 Step 4: Create Booking" -ForegroundColor Yellow

$customerToken = $tokens["xolinxiweni@gmail.com"]
$customerHeaders = @{ "Authorization" = "Bearer $customerToken"; "Content-Type" = "application/json" }

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/services" -Method GET -UseBasicParsing
    $services = $response.Content | ConvertFrom-Json
    
    if ($services.Count -gt 0) {
        $firstService = $services[0]
        $bookingBody = @{
            serviceId = $firstService.id
            date = "2025-10-20T10:00:00.000Z"
            time = "10:00"
            location = @{
                type = "Point"
                coordinates = @(28.0473, -26.2041)
                address = "123 Test Street, Johannesburg, South Africa"
            }
            notes = "Please bring all necessary cleaning supplies"
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri "$baseUrl/bookings" -Method POST -Body $bookingBody -Headers $customerHeaders -UseBasicParsing
        Write-Host "✅ Created booking for service: $($firstService.title)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to create booking: $($_.Exception.Message)" -ForegroundColor Red
}

# Test getting bookings
Write-Host "`n📝 Step 5: Get Bookings" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/bookings" -Method GET -Headers $customerHeaders -UseBasicParsing
    $bookings = $response.Content | ConvertFrom-Json
    Write-Host "✅ Retrieved $($bookings.value.Count) bookings" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to retrieve bookings: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Data Population Test Complete!" -ForegroundColor Green
