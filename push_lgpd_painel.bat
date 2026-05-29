@echo off
chcp 65001 >nul
echo ==============================================
echo  PUSH — Painel LGPD + rotas + sidebar
echo ==============================================

cd /d "%~dp0"

:: Remove lock se existir
if exist ".git\index.lock" del /f ".git\index.lock"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"

:: Arquivos do painel LGPD (nova página)
git add src/pages/LgpdAdmin.tsx

:: Rotas e navegação
git add src/App.tsx
git add src/components/layout/AppLayout.tsx
git add src/components/layout/UserMenuButton.tsx

:: Verificar o que vai no commit
echo.
echo Arquivos a commitar:
git diff --cached --name-only
echo.

git commit -m "feat: painel LGPD — solicitacoes, consentimentos, auditoria, politica

- LgpdAdmin.tsx: painel completo com 4 abas (Solicitacoes / Consentimentos / Auditoria / Politica)
- Cards de resumo: total, pendentes, vencidos, consentimentos ativos
- Gerenciar solicitacoes: Em analise / Concluir / Negar com prazo de 15 dias
- Alert visual para prazos vencidos (LGPD Art. 18)
- App.tsx: rota /admin/lgpd registrada
- AppLayout.tsx: link Painel LGPD na sidebar (admin/secretaria)
- UserMenuButton.tsx: item Painel LGPD no dropdown mobile"

echo.
echo Fazendo push...
git push origin main

echo.
if %ERRORLEVEL% == 0 (
  echo [OK] Push concluido com sucesso!
) else (
  echo [ERRO] Push falhou. Verifique o erro acima.
)
pause
