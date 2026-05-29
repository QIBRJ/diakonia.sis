Set-Location $PSScriptRoot
if (Test-Path ".git\index.lock") { Remove-Item ".git\index.lock" -Force }
if (Test-Path ".git\HEAD.lock")  { Remove-Item ".git\HEAD.lock"  -Force }
$files = @("src\App.tsx","src\components\layout\AppLayout.tsx","src\components\layout\UserMenuButton.tsx")
foreach ($f in $files) { if (Test-Path $f) { (Get-Item $f).LastWriteTime = Get-Date } }
git update-index --really-refresh 2>$null
git rm --cached src/App.tsx 2>$null
git rm --cached src/components/layout/AppLayout.tsx 2>$null
git rm --cached src/components/layout/UserMenuButton.tsx 2>$null
git add src/App.tsx
git add src/components/layout/AppLayout.tsx
git add src/components/layout/UserMenuButton.tsx
git add src/pages/LgpdAdmin.tsx
Write-Host ""; git diff --cached --name-only
git commit -m "feat: painel LGPD solicitacoes consentimentos auditoria politica"
git push origin main
Write-Host "Pronto!"
