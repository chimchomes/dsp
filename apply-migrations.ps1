# Apply Supabase migrations using CLI
$projectRef = "rkrggssktzpczxvjhrxm"
$supabaseUrl = "https://rkrggssktzpczxvjhrxm.supabase.co"

Write-Host "🔗 Linking to Supabase project..." -ForegroundColor Cyan
npx supabase link --project-ref $projectRef --skip-pooler

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Linked successfully!" -ForegroundColor Green
    Write-Host "📤 Pushing migrations..." -ForegroundColor Cyan
    npx supabase db push --linked --include-all --yes
} else {
    Write-Host "❌ Linking failed. You may need to provide database password." -ForegroundColor Red
    Write-Host "Run manually: npx supabase link --project-ref $projectRef" -ForegroundColor Yellow
}
