# Motion Frame

A local, Windows-ready Electron app for finding and saving a frame from a motion photo.

**Download status:** source is public under MIT. Prebuilt Windows downloads are not yet public while matching-source delivery for bundled GPLv3 FFmpeg is completed. Build locally using the Development instructions below. The existing owner-only installer remains available privately.

## Windows quick start

1. Download **Motion-Frame-Setup-1.1.0-Windows-x64.exe**.
2. Run it to install for your Windows account. No administrator access, Node.js, FFmpeg installation, or codec pack is needed.
3. Open **Motion Frame** from the desktop or Start menu (it also opens after installation).
4. Drag a motion photo into the window, or click **Open photo**.
5. Browse the thumbnail strip, move the slider, use the arrow keys, or scroll over the preview.
6. Click **Save frame as JPG**, choose a filename and folder, and save.

The app runs on Windows 10/11 x64. Builds are unsigned, so Windows may show an unrecognized-app prompt. It does not require administrator access.

Uninstall through **Settings → Apps → Installed apps → Motion Frame**. Your source photos and exported JPGs are not removed. Future installers with the same app identity replace the installed version.

Prefer no installer? Download **Motion-Frame-1.1.0-Windows-x64.zip**, choose **Extract All**, and open **Motion Frame.exe**. The portable folder and installed app are separate; installing does not remove an older portable copy.

## Features

- Samsung and Google/Pixel **JPEG Motion Photos** with embedded MP4 video.
- H.264 and HEVC decoding, independent of Windows codec availability.
- Opens standalone MP4/MOV clips as well.
- Full-frame preview, playback, thumbnail strip, exact frame selection and timecode.
- Original still-photo tab; defaults near the capture timestamp when it is present.
- Saves the selected decoded frame as a high-quality JPEG, at the frame's native resolution and with orientation applied.
- Input photos are never edited. Frames are cached in a private temporary directory and removed on normal exit.
- Entirely offline after downloading; no accounts, analytics, network APIs, or photo uploads.

Motion frames often have a lower resolution than the primary still photo. This app preserves the motion frame's resolution; it does not upscale it. A JPG shared through messaging or edited by another app may have lost its motion video; use the original phone file in that case. HEIC motion photos and Apple's separate HEIC+MOV Live Photo pairs are not currently supported (the MOV can be opened on its own).

## Keyboard and mouse

| Control | Action |
|---|---|
| Ctrl+O | Open a photo |
| Left / Right | Previous / next frame |
| Home / End | First / last frame |
| Space | Play / pause when the preview is focused |
| Ctrl+S | Save selected frame |
| Wheel over preview | Step through frames |
| Frame number | Jump directly to a frame |

## Development

Requires Node.js 22+ and npm. From the project folder:

```sh
npm ci
npm start
npm test
npm run build:win
```

`build:win` regenerates the icons, prepares the Windows FFmpeg binary, and writes a per-user NSIS installer and portable ZIP in `dist/`. Linux cross-builds reuse electron-builder's own unsigned-uninstaller binary reader without Wine; see `scripts/nsis-linux.cjs`. Dependencies and binaries are pinned; the first install/build needs network access. Electron and FFmpeg are bundled in the finished app.

The editable icon is `src/assets/icon.svg`. `npm run icons` uses resvg to generate its PNG and nine-size Windows ICO. A resedit `afterPack` hook embeds the icon and product/version metadata in the Windows executable without signing it. The same artwork appears in the app header, taskbar, shortcuts, installer, and uninstall entry.

### Integration checks

Set `MOTION_PHOTO_FIXTURE` to the original 107-frame sample JPG to include the real-file decoder integration test. Do not commit personal photos. `npm run test:ui` runs the Electron UI integration test on Linux under Xvfb; it requires the same fixture variable. `MOTION_TEST_TMP` selects a scratch output directory for tests and screenshots.

See [PROJECT.md](PROJECT.md) for architecture, verification results and limitations. Third-party notices are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## License

Motion Frame's original code, documentation, and icon artwork are licensed under the [MIT License](LICENSE), copyright (c) 2026 Dave Lutz.

Third-party components retain their own licenses. In particular, the separately executed, bundled Windows FFmpeg binary is GPLv3, not MIT. Retain its license and satisfy its corresponding-source requirements when redistributing it; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
