---
name: motion-frame
description: Windows Electron motion-photo viewer, frame browser, and JPEG exporter.
status: live
built: 2026-10-11
agent: main
---

# Motion Frame — Project Reference

## Product

Offline Windows 10/11 x64 Electron app. Drag in a Samsung/Google JPEG Motion Photo or MP4/MOV, browse every frame, play the sequence, and save the selected native-resolution frame as JPG. Includes an original-still preview, wheel/keyboard navigation, thumbnails, scrubber, frame-number entry, cancellation, and source-overwrite protection.

Version 1.1.0 adds an editable vector icon, Windows executable/product branding, and an NSIS per-user installer. Start-menu and desktop shortcuts use the same icon. Uninstall through Windows Settings; photos and exported images stay untouched. A portable ZIP is also built.

The owner authorized **public repository visibility** on October 11, 2026, after selecting MIT for Motion Frame's original code, documentation, and icon artwork. This supersedes the earlier private-repository instruction. Third-party components retain their own licenses, including GPLv3 for the separately executed FFmpeg binary.

Public source repository: https://github.com/davelutztx/motion-frame . The v1.1.0 binary release is retained as a draft, not publicly downloadable, until matching FFmpeg source delivery is verified. The binary provider's b6.1.1 release has no complete corresponding-source asset; its Windows README identifies numerous external libraries and only an FFmpeg source commit. An upstream FFmpeg tarball alone does not account for that build. Preserve the owner's private downloads; do not claim public binary distribution is ready. Next action: obtain the complete matching source/build materials, or rebuild the decoder from a controlled source bundle and verify a replacement release.

## Architecture

- `src/motion-photo.cjs`: bounds-checked ISO BMFF parser. Recognizes JPEG/MP4, checks for a video track, prefers Samsung's `MotionPhoto_Data`, otherwise chooses the largest valid movie, excludes SEF trailer, and reads capture timestamps.
- `src/media.cjs`: extracts an embedded movie to per-session temporary storage and invokes bundled FFmpeg without a shell. Produces q=1 JPEG frames with presentation timestamps. Cancel/timeout cleanup; export by direct byte copy with source path/alias protection.
- `src/main.cjs`: native open/save dialogs, strict sender-checked IPC, temporary-file lifecycle, and current-session-only `motion://asset/` protocol. No server or external API. Stable Windows AppUserModelID matches the installer.
- `src/preload.cjs`: constrained contextBridge API and `webUtils.getPathForFile` for OS drag/drop. Renderer is sandboxed with context isolation and no Node integration.
- `src/index.html`, `styles.css`, `renderer.js`: local-only UI with CSP, timed playback, motion/original distinction, and error recovery.
- `src/assets/icon.svg`: editable gold stacked-frame/play artwork. `scripts/generate-icons.cjs` renders a 512px PNG and ICO sizes 16/20/24/32/40/48/64/128/256 using resvg.
- `scripts/windows-resources.cjs`: resedit afterPack hook writes the icon and product/version resources into the unsigned intermediate EXE before packaging; no binary patching of installed apps.
- `scripts/prepare-windows.cjs`: prepares ffmpeg-static's b6.1.1 Windows x64 binary and bundled provider notices.
- `scripts/verify-package.cjs`: packaged-source equality, PE architecture, FFmpeg equality, notices, no personal media, every embedded icon size, product/version metadata, and optional installer icon check.

## Dependencies and build

Electron 44.7.0; electron-builder 26.15.3; ffmpeg-static 5.3.0; Playwright 1.64.0; resvg 2.6.2; resedit 1.7.2. Exact versions and lockfile are committed. Development/build dependencies do not ship as runtime Node dependencies.

```sh
npm ci
npm start
npm test
npm run build:win
node scripts/verify-package.cjs dist/win-unpacked dist/Motion-Frame-Setup-1.1.0-Windows-x64.exe
```

`build:win` builds NSIS and ZIP, regenerates icons, and prepares FFmpeg. Linux cross-builds use the same built-in `UninstallerReader` that electron-builder uses on macOS. The narrowly scoped process-local adapter in `scripts/nsis-linux.cjs` is restricted to the exact unsigned setup filename, checks the pinned builder version, and does not modify dependencies or installer scripts. The first install/build downloads dependencies and tools. Neither the app nor installer needs an account or network to process photos.

Build output defaults to `dist/`; use `--config.directories.output=<scratch-directory>` to redirect it. Local heavy dependencies and vendor binaries may be symlinked to external scratch storage. Symlinks, dependencies, binaries, build outputs, personal media, logs, and environment files are excluded from Git. The committed ICO/PNG are generated branding assets, not personal pictures.

## Decisions and limits

- Existing-solution preflight considered GoMoPho, ExtractMotionPhotos, MotionPhoto2, and galaxy_motion_photo_extractor. They did not provide the requested Windows Electron frame-picker. Reuse FFmpeg, electron-builder/NSIS, resvg, and resedit instead of implementing codecs or installer machinery.
- FFmpeg runs separately so HEVC decoding does not depend on Windows codec purchases or Chromium codec support.
- Decode once, browse local JPEGs, export without a second lossy encode. No audio playback.
- Native motion-frame dimensions are preserved; no AI upscaling. Motion frames can be substantially smaller than the main still; Samsung Gallery can enhance selected frames on supported phones.
- Input limit: 512 MB; decoded-frame limit: 1,800; decoder timeout: two minutes; two FFmpeg threads.
- Ordinary JPEGs remain viewable. HEIC motion photos and paired Apple Live Photos are unsupported; individual MOV clips work.
- App and installer are unsigned. Signing certificates and paid services were not purchased.
- The app license is MIT. Redistribution of bundled GPLv3 FFmpeg still requires appropriate corresponding-source delivery and notices; the app's MIT license does not replace those terms.

## Verification

- Initial 1.0.0: twelve core tests and seven Electron UI groups passed on Linux; packaged Windows source/binaries and ZIP checked. Owner confirmed it works on Windows.
- 1.1.0: twelve core tests and seven Electron UI groups passed again on Linux/Xvfb, including real disk-backed File drag/drop, all 107 sample frames, exact selected-frame/export byte equality, navigation/playback, overwrite protection, cancellation, and malformed/plain JPEG behavior. Icon and empty-state UI visually inspected. Packaged nine-size icons, version resources, source/assets, PE architecture, and notices checked.
- Test fixtures and screenshots remain outside Git. Windows-native installer execution is distinct from Linux/Wine checks and must not be claimed without a real Windows run.
- Final 1.1.0 NSIS installer: 133,341,437 bytes. Installer extraction and nested application archive integrity passed; extracted EXE and app.asar byte-match the verified unpacked build. Portable ZIP integrity also passed. The embedded uninstaller and custom uninstall icon are present. No native Windows install/uninstall run has been performed.

## Lessons

- Samsung files can contain a metadata MP4 before the real motion MP4 plus a SEFT trailer. Do not use first-`ftyp` or naive last-N-byte extraction.
- Under Wayland, UI tests explicitly use `--ozone-platform=x11` with Xvfb and an isolated profile. `--no-sandbox` is only used in Linux tests, never in the distributed app.
- Set `MOTION_PHOTO_FIXTURE` for private integration data and `MOTION_TEST_TMP` to scratch on the fixture's filesystem: the source-alias protection test uses a hard link and cannot span mounts.
- Windows can retain image read handles briefly. Old-cache cleanup retries on exit; cancelled decoding waits for process close.
- Large Windows downloads need authenticated downloadable links or private release assets, not Linux absolute-path links.
- electron-builder's Wine 1.0.1 Linux bundle failed to initialize ntdll (missing Windows DLL layout). Use the builder's existing binary-reader path for unsigned cross-builds instead. Recheck the adapter on electron-builder upgrades. No system packages or shared platform configuration were changed.
