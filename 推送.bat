@echo off
cd /d "%~dp0"

set "GIT=git"
where git >nul 2>&1
if errorlevel 1 set "GIT=F:\Git\cmd\git.exe"

echo ============================================
echo   OPC 风险筛查 V3.7   源码推送
echo   作者：羽织梦
echo ============================================
echo.
echo   远程仓库：https://github.com/speedacs/opc.git
echo   分支：main
echo.
echo   首次推送会弹出登录窗口：可选择浏览器登录 GitHub，
echo   或把 Personal Access Token 粘贴到密码处。
echo.

"%GIT%" push -u origin main
if not errorlevel 1 goto ok

echo.
echo   第一次推送未成功，尝试切换 TLS 后端后重试...
"%GIT%" -c http.sslBackend=openssl push -u origin main
if not errorlevel 1 goto ok

echo.
echo   [失败] 推送未完成，请依次检查：
echo     1) 代理是否已启动（本仓库使用 127.0.0.1:7890）
echo     2) GitHub 登录是否完成
echo     3) 账号 speedacs 是否有该仓库的写入权限
goto end

:ok
echo.
echo   [成功] 源码已推送到 https://github.com/speedacs/opc
echo   打开网页即可查看全部源码文件。

:end
echo.
pause
