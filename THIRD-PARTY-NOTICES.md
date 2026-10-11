# Third-party software

Motion Frame's original code, documentation, and icon artwork are MIT licensed, copyright (c) 2026 Dave Lutz; see LICENSE. The MIT license does not relicense any third-party component. No photographs are included in the distribution.

## Electron

Electron is MIT licensed; Chromium, Node.js, and their dependencies have their own licenses. The Windows application folder includes Electron's LICENSE and LICENSES.chromium.html files.

- https://github.com/electron/electron
- https://www.electronjs.org/

## FFmpeg

FFmpeg is executed as a separate, bundled command-line program. Its binary is supplied through ffmpeg-static 5.3.0, binary release b6.1.1. This Windows build is GPLv3 licensed, not MIT. Its provider's license and build README are included alongside the executable as resources/bin/ffmpeg.exe.LICENSE and resources/bin/ffmpeg.exe.README. Please retain those files.

- Binary provider, build scripts and source information: https://github.com/eugeneware/ffmpeg-static/tree/b6.1.1
- Binary release and related assets: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
- FFmpeg source: https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz
- FFmpeg license information: https://ffmpeg.org/legal.html

When redistributing the bundled FFmpeg binary, preserve its notices and provide the corresponding source using a method permitted by GPLv3. This applies to redistribution, not only public GitHub releases. Corresponding source must match the actual binary, including covered libraries, patches, and build scripts; the FFmpeg upstream tarball alone is not necessarily sufficient. The links above identify upstream/provider resources, not a claim that this repository contains a complete corresponding-source bundle. Review that delivery before distributing the installer beyond the owner's private use.
