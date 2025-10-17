@echo off
echo 🚀 Starting SPANA Backend Development Server...

set DATABASE_URL=postgresql://spana_users:U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH@dpg-d3p2ooc9c44c738ksb8g-a.frankfurt-postgres.render.com/spana_db
set POSTGRES_HOST=dpg-d3p2ooc9c44c738ksb8g-a
set POSTGRES_USER=spana_users
set POSTGRES_PASSWORD=U2kOB5yHZDB5vI9tuEfPqLB2t52Ai3SH
set POSTGRES_DB=spana_db
set POSTGRES_PORT=5432
set POSTGRES_SSL=true
set NODE_ENV=development
set PORT=5003

echo ✅ Environment variables set
echo 🔗 DATABASE_URL: Set
echo 🔗 POSTGRES_HOST: %POSTGRES_HOST%
echo 🔗 POSTGRES_USER: %POSTGRES_USER%
echo 🔗 POSTGRES_DB: %POSTGRES_DB%
echo 🔗 POSTGRES_SSL: %POSTGRES_SSL%

echo.
echo 🚀 Starting development server...
npm run dev
