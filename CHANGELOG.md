## Release Notes

### 88.10.0 - build 88100



# 88.9.2 - build 8992

- Fixed incomplete entry banner in the branch entries view.
- Stronger language files validation
- Fixed Catalan translation

# 88.9.1 - build 8891

- Added German translation

# 88.9.0 - build 8890

 - Added feature to clone a single entry or branch entry

# 88.8.1

- Enhanced Slovenian translation

# 88.8.0 - build 8880

- Capacitor 8 update
- Fixed navigation to prevent accidental back-button dismissal while audio, video encoding, or location modals are open.
- Enhanced barcode scanner with improved hint detection for better scanning accuracy.
- Audio is recorded as AAC with mp4 extension and 64kbps bitrate on both Android and iOS. 
- Video is encoded as AAC/H264 with mp4 extension, 30fps and ~2Mbps bitrate on both Android and iOS.
- Android Target SDK updated to 36 (Android 15)


# 87.2.5 - build 8725

- Updated several dependency versions.
- Fake photos now use dynamically generated test images.
- Improved handling of data-URL/base64 image inputs.
- Enhanced error handling and propagation for fake photo creation.

# 87.2.4 - build 8724

- Better uuid v4 generation
- Better DATE sanitization for DATE questions

# 87.2.3 - build 8723

- Increased delay for uploads, both data and media, to avoid server overload

# 87.2.2 - build 8722

- Added warning card on entries upload page to inform users media must be uploaded separately

# 87.2.1 - build 8721

- Added copy button to location edit panel to copy lat, long to clipboard
- Fixed toast not showing on Android 12 and below when copying to clipboard

# 87.2.0 - build 8720

- Replace barcode plugin with Capacitor one
- Fixed bugs and stability improvements

# 87.1.0 - build 8710

- Upgraded cordova sqlite storage plugin to support 16kb page size devices

# 87.0.0 - build 8700

- Upgraded to Capacitor 7 to target API 35 (Android 15)
- Fixed edge to edge issue on Android 15 using new plugin
- Fixed bugs and stability improvements
- Fixed regression bugs

# 86.2.2 - build 8622

- Using exact match when searching for projects opened by an App Link

# 86.2.1 - build 8621

- Updated build number to match Ionic 8 - Capacitor 6 versions
- Fixed wrong sorting of forms on the download entries page
- Fixed header for alert notification
- Added Slovenian translation
- Added warning about manual project addition on the projects page
- Fixed bugs and stability improvements


# 76.1.0 - build 7610

- Potential fix for "Error code 1" on IOS by using private temp folder
- Replaced toast Ionic library with Capacitor one due to bugs
- Added timeout to DB opening due to warnings
- Fixed bugs and stability improvements

# 7.0.4

- Added Catalan translation
- Fixed permissions issues on Android 11

# 7.0.3

- UI improvements
- Disabled Ionic 8 dynamic fonts as CSS zoom is used

# 7.0.1

- Location popover UI improvements
- Capacitor 6 update
- Ionic 8 update
