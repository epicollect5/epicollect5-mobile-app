## Release Notes

# 98.2.3 - build 9823

 - Fixed the Android software keyboard covering the bottom of the screen on Android 15+; the edge-to-edge plugin is now pinned to exact 8.0.6, because 8.0.7+ collapses the WebView bottom margin while the keyboard is open.

# 98.2.2 - build 9822

 - Fixed a crash when pressing the Android hardware back button while a project update is in flight on the entries page (navigation is now locked until the update completes).
 - Pinned @capawesome/capacitor-android-edge-to-edge-support to exact 8.0.6 for Android keyboard compatibility; 8.0.7+ buries GROUP inputs (capawesome-team/capacitor-plugins#847).

# 98.2.1 - build 9821

 - Fixed a crash when opening an entry for editing whose group answers predate the form (missing group child answers are now shown empty instead of crashing).
 - Fixed back-button navigation in the entry editor being swallowed before reaching the previous question.

# 98.2.0 - build 9820

 - Added an in-app (embedded) camera for photo questions with live preview, flash handling, orientation-aware resize, and 1024x768 captures for server requirements, plus a settings toggle to enable it.
 - Added video recording mode to the in-app camera preview, wired into bootstrap, settings, and the video flow.
 - Preserved EXIF data in embedded camera captures, including large captures and JPEG segment copy; strip out-of-line GPS bytes when removing EXIF.
 - Hardened the camera session lifecycle: serialize teardown and recording, recover the preview when backgrounded mid-startup, surface open/init/finalize failures to the user, and release native sessions and image memory on failure.
 - Fixed photo replacement and retake flows to preserve existing media on dismiss or failure and keep video refs when a native retake fails.
 - Hardened branch media and file-delete handling: defer deletions to hierarchy save, scope the delete queue by entry, reset stale queues when opening entries, guard saves against stale queues, hide blanked-answer media on branch reopen, and drop branch deletions on quit.
 - Fixed saved-answers crashes (missing keys, hits-cap overflow) and capped hits per append; bound title filter params to prevent SQLite errors.
 - Fixed entries-filter counts going stale during reset and failures, preserving filter state and debouncing updates.
 - Hardened error reporting with non-serializable-safe context and capped function values, and track failed video captures; guarded the back button during export and download prompts.
 - Added the @capgo/camera-preview plugin to native platforms and handled its Vite vendor chunking.

# 98.1.0 - build 9810

 - Added a draw pad for photo questions, opened from the photo media popover and the photo question.
 - Unified pen colour and thickness into a single settings modal; added signature_pad dependency.
 - Hardened the draw/photo save workflow: block saves during background loads, claim a draw lock, keep the original photo on clear, and prevent blank-canvas replacement.
 - Prevented temp file overwrite on failed moves and backed up the original file before atomic move.
 - Retry restore and report/recover from a recoverable backup; promote the answer to a `.bak` on recoverable backup.
 - Fixed drawing workflow, file save, and popover action handling; ignore the back button while the draw modal is open.
 - Fixed saving media while the background photo loads; reset the loading flag on background load failure.

# 98.0.0 - build 9800

 - Migrated the build toolchain from Vue CLI to Vite (VITE_ environment variables and a WEBVIEW build mode).
 - Upgraded to Ionic 9 and bumped peer dependencies.
 - Added the capacitor-native-settings plugin and diagnostic plugin features to the native config.
 - Handle notification permission denied for the Android foreground download service.
 - Stopped phantom photo & video media being saved when a capture is cancelled.
 - Fixed decimal and integer question inputs decrementing instead of incrementing on step.
 - Prevented crashes on missing or invalid answers.
 - Guarded loader removal against a missing element.
 - Updated the web app title to Epicollect5.
 - Create the project logo directory before download to avoid failures.
 - Migrated unit tests to Vitest (e2e tests removed).

# 88.9.9 - build 8899

 - Block back-nav and abort mid-download when project changes; 
 - Block downloads while entries unsynced/errored; 
 - Stop downloads for trashed projects; 
 - Docs link in confirmation dialogs.
 - Refactored multiple modal dismissal to avoid race condition errors. 
 - Switched to Capawesome foreground-service plugin; 
 - Delete entries/media of server-deleted forms; remove orphaned branch entries and related media.
 - Guard navigation against deleted parents with confirmation dialog;
 - Filter stale forms in branch export;
 - iOS datetime styles, location-title size, input borders;
 - Project search as a base64 data URI embedded in the search response (`logo_base64`); falls back to the client-side logo URL when the feature flag is off; 

# 88.9.8 - build 8898

 - Fixed bug with upload progress (delays too long)

# 88.9.7 - build 8897

- Added entries download progress service
- Resume interrupted downloads with per-form progress UI, resume/restart prompts.
- Added clear-progress action and progress modal with cancel.

# 88.9.6 - build 8896

- Export entries as a compressed archive for sharing
- "Send to Device" export to store project data on the device
- Real-time progress modal with percentage during exports

# 88.9.5 - build 8895

- Added ability to export project entries to CSV files.
- Integrated geographic coordinate conversion to UTM format for location.
- Enhanced file export mechanism with better directory management across Android and iOS platforms.
- Expanded multi-language support with localized labels for entry export functionality.

# 88.9.4 - build 8894

- Added PWA support
- Fixed bugs and stability improvements

# 88.9.3 - build 8893

- Added Media export option.
- Entry-limit checks removed from the app.
- iOS file sharing and in-place document opening enabled.
- Localized labels for media export added.
- Export and filesystem flows unified to use app Documents folder

# 88.9.2 - build 8892

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
- Fixed edge-to-edge issue on Android 15 using new plugin
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
