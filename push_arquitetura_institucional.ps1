$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

$files = @(
  "src/pages/Ministerios.tsx",
  "src/pages/IdentidadeAdmin.tsx",
  "src/App.tsx",
  "src/components/layout/AppLayout.tsx",
  "src/components/layout/UserMenuButton.tsx"
)

foreach ($f in $files) {
  $full = Join-Path $projectDir $f
  if (Test-Path $full) {
    (Get-Item $full).LastWriteTime = Get-Date
    git rm --cached $f 2>$null
    git add $f
  }
}

git status
git commit -m "feat: auto-preenchimento ministerios + pagina identidade da igreja

- Ministerios.tsx: debounce 600ms chama buscar_modelo_ministerio()
  mostra banner dourado com nome do modelo + botao Aplicar
- IdentidadeAdmin.tsx: nova pagina /admin/identidade
  gerencia missao, visao, CNPJ, data fundacao e valores institucionais
- App.tsx: rota /admin/identidade registrada
- AppLayout.tsx: link 'Identidade da Igreja' na secao Admin do sidebar
- UserMenuButton.tsx: item 'Identidade da Igreja' no menu dropdown"

git push origin main
Write-Host ""
Write-Host "Deploy iniciado no Vercel!" -ForegroundColor Green
