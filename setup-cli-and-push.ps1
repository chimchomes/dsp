# Setup Supabase CLI and push migrations
$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Supabase CLI Migration Setup`n" -ForegroundColor Cyan

# Check if already linked
if (Test-Path "supabase\.temp\project-ref") {
    Write-Host "✅ Project already linked" -ForegroundColor Green
    Write-Host "📤 Pushing migrations...`n" -ForegroundColor Cyan
    npx supabase db push --linked --include-all --yes
    exit $LASTEXITCODE
}

Write-Host "🔗 Linking project (you'll be prompted for database password)..." -ForegroundColor Yellow
Write-Host "   Project: rkrggssktzpczxvjhrxm`n" -ForegroundColor Gray

# Try to link
npx supabase link --project-ref rkrggssktzpczxvjhrxm --skip-pooler

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Linked! Pushing migrations...`n" -ForegroundColor Green
    npx supabase db push --linked --include-all --yes
} else {
    Write-Host "`n❌ Linking requires database password." -ForegroundColor Red
    Write-Host "`nRun manually:" -ForegroundColor Yellow
    Write-Host "  npx supabase link --project-ref rkrggssktzpczxvjhrxm --skip-pooler" -ForegroundColor White
    Write-Host "  npx supabase db push --linked --include-all --yes" -ForegroundColor White
    exit 1
}
