# SPANA Backend Development Startup Script
# This script sets the environment variables and starts the development server

Write-Host "🚀 Starting SPANA Backend Development Server..." -ForegroundColor Green

# Set environment variables
$env:DATABASE_URL = "postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db"
$env:POSTGRES_HOST = "dpg-d3p2ooc9c44c738ksb8g-a"
$env:POSTGRES_USER = "spana_users"
$env:POSTGRES_PASSWORD = "U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH"
$env:POSTGRES_DB = "spana_db"
$env:POSTGRES_PORT = "5432"
$env:POSTGRES_SSL = "true"
$env:NODE_ENV = "development"
$env:PORT = "5003"

Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host "🔗 DATABASE_URL: Set" -ForegroundColor Cyan
Write-Host "🔗 POSTGRES_HOST: $env:POSTGRES_HOST" -ForegroundColor Cyan
Write-Host "🔗 POSTGRES_USER: $env:POSTGRES_USER" -ForegroundColor Cyan
Write-Host "🔗 POSTGRES_DB: $env:POSTGRES_DB" -ForegroundColor Cyan
Write-Host "🔗 POSTGRES_SSL: $env:POSTGRES_SSL" -ForegroundColor Cyan

Write-Host "`n🚀 Starting development server..." -ForegroundColor Yellow
npm run dev
