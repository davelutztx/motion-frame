# Motion Frame

A local, Windows-ready Electron app for finding and saving a frame from a motion photo.

**Source-only release:** no prebuilt installer or portable ZIP is currently available. Run from source using the instructions below.

## Run from source

Requires Git, Node.js 22+ and npm. Windows 10/11 x64 is the target platform.

```sh
git clone https://github.com/davelutztx/motion-frame.git
cd motion-frame
npm ci
npm start
```

The initial dependency installation needs internet access. Once installed, photo processing is entirely local.

### Use the app

1. Drag a motion photo into the window, or click **Open photo**.
2. Browse the thumbnail strip, move the slider, use the arrow keys, or scroll over the preview.
3. Click **Save frame as JPG**, choose a filename and folder, and save.

## Features

- Samsung and Google/Pixel **JPEG Motion Photos** with embedded MP4 video.
- H.264 and HEVC decoding, independent of Windows codec availability.
- Opens standalone MP4/MOV clips as well.
- Full-frame preview, playback, thumbnail strip, exact frame selection and timecode.
- Original still-photo tab; defaults near the capture timestamp when it is present.
- Saves the selected decoded frame as a high-quality JPEG, at the frame's native resolution and with orientation applied.
- Input photos are never edited. Frames are cached in a private temporary directory and removed on normal exit.
- Entirely offline after dependency installation; no accounts, analytics, network APIs, or photo uploads.

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

After installing dependencies as described above, run tests or create a local Windows package:

```sh
npm test
npm run build:win
```

`build:win` regenerates the icons, prepares the Windows FFmpeg binary, and writes a per-user NSIS installer and portable ZIP in `dist/`. Linux cross-builds reuse electron-builder's own unsigned-uninstaller binary reader without Wine; see `scripts/nsis-linux.cjs`. Dependencies and binaries are pinned; the first install/build needs network access. Electron and FFmpeg are bundled in the finished app.

These are locally generated, unsigned packages—not hosted downloads. Public binary releases are on hold until matching-source delivery for bundled GPLv3 FFmpeg is verified; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

The editable icon is `src/assets/icon.svg`. `npm run icons` uses resvg to generate its PNG and nine-size Windows ICO. A resedit `afterPack` hook embeds the icon and product/version metadata in the Windows executable without signing it. The same artwork appears in the app header, taskbar, shortcuts, installer, and uninstall entry.

### Integration checks

Set `MOTION_PHOTO_FIXTURE` to the original 107-frame sample JPG to include the real-file decoder integration test. Do not commit personal photos. `npm run test:ui` runs the Electron UI integration test on Linux under Xvfb; it requires the same fixture variable. `MOTION_TEST_TMP` selects a scratch output directory for tests and screenshots.

See [PROJECT.md](PROJECT.md) for architecture, verification results and limitations. Third-party notices are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## License

Motion Frame's original code, documentation, and icon artwork are licensed under the [MIT License](LICENSE), copyright (c) 2026 Dave Lutz.

Third-party components retain their own licenses. In particular, the separately executed, bundled Windows FFmpeg binary is GPLv3, not MIT. Retain its license and satisfy its corresponding-source requirements when redistributing it; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
