@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo   OPC 风险筛查 V3.7  源码推送脚本
echo   作者：羽织梦
echo ============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [错误] 当前目录不是 Git 仓库，请确认脚本放在源码包目录下。
  pause
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo 请粘贴 GitHub 仓库地址（形如 https://github.com/用户名/仓库名.git）：
  set /p REPO_URL=
  if "%REPO_URL%"=="" (
    echo [取消] 未填写仓库地址。
    pause
    exit /b 1
  )
  git remote add origin "%REPO_URL%"
  echo [完成] 已添加远程仓库：%REPO_URL%
) else (
  echo [提示] 已存在远程仓库：
  git remote -v
)

echo.
echo 正在推送（首次推送会要求登录，密码处请填写 Personal Access Token）...
git branch -M main
git push -u origin main
if errorlevel 1 (
  echo.
  echo [提示] 首次推送失败，尝试切换 TLS 后端后重试...
  git -c http.sslBackend=openssl push -u origin main
)

if errorlevel 1 (
  echo.
  echo [失败] 推送未完成，请检查：
  echo   1) 本机代理是否已启动（本仓库 Git 配置使用 http://127.0.0.1:7890）
  echo   2) GitHub 仓库地址是否正确
  echo   3) 登录是否使用 Personal Access Token
) else (
  echo.
  echo [成功] 源码已推送到 GitHub，可打开 https://github.com/speedacs/opc 查看。
)

echo.
pause
