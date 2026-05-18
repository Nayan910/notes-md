@echo off
set PATH=C:\Users\nayan\flutter\bin;%PATH%
set ANDROID_HOME=E:\apps\android-sdk
cd /d E:\oprncode\project\apps\notes-md-app
echo Building APK... > E:\oprncode\project\build-apk.log
flutter build apk --debug >> E:\oprncode\project\build-apk.log 2>&1
echo DONE >> E:\oprncode\project\build-apk.log
