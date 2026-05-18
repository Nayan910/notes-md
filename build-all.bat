@echo off
set PATH=C:\Users\nayan\flutter\bin;%PATH%
set ANDROID_HOME=E:\apps\android-sdk

echo ========================================
echo Building notes.md Android APK...
echo ========================================
cd /d E:\oprncode\project\apps\notes-md-app
flutter build apk --debug > E:\oprncode\project\build-apk.log 2>&1
if %ERRORLEVEL% EQU 0 (
    echo APK BUILD SUCCESS >> E:\oprncode\project\build-apk.log
) else (
    echo APK BUILD FAILED (code %ERRORLEVEL%) >> E:\oprncode\project\build-apk.log
)

echo ========================================
echo Building notes.md Windows app...
echo ========================================
cd /d E:\oprncode\project\apps\notes-md-app
flutter build windows > E:\oprncode\project\build-windows.log 2>&1
if %ERRORLEVEL% EQU 0 (
    echo WINDOWS BUILD SUCCESS >> E:\oprncode\project\build-windows.log
) else (
    echo WINDOWS BUILD FAILED (code %ERRORLEVEL%) >> E:\oprncode\project\build-windows.log
)

echo ========================================
echo Copying APK to project root...
echo ========================================
copy /Y E:\oprncode\project\apps\notes-md-app\build\app\outputs\flutter-apk\app-debug.apk E:\oprncode\project\notes-md-debug.apk

echo ALL DONE >> E:\oprncode\project\build-all.log
