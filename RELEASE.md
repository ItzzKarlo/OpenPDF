# Release guide

Releases are built by `.github/workflows/release.yml` from an existing `v*` tag. The workflow validates that `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` all contain the same version and that the tag is exactly `v<version>`.

The workflow creates one draft GitHub Release, builds every required package on a native runner, uploads architecture-specific assets through `tauri-apps/tauri-action@v1`, and publishes only after every matrix job and package verification succeeds. A prerelease SemVer such as `0.2.0-beta.1` automatically creates a GitHub prerelease. Failed builds leave a draft for diagnosis; they do not publish a stable release.

## Required release checklist

- [ ] Update the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- [ ] Run `node scripts/check-version.mjs` and commit regenerated `Cargo.lock`/`package-lock.json` changes when applicable.
- [ ] Review [FEATURE_STATUS.md](FEATURE_STATUS.md) and user-facing limitations.
- [ ] Run typecheck, lint, unit tests, Playwright tests, frontend build, Rust tests, formatting, and Clippy.
- [ ] Merge the version change to `main` and confirm `.github/workflows/ci.yml` passes all five native targets.
- [ ] Create and push an annotated `v<version>` tag.
- [ ] Confirm both macOS DMGs, Windows NSIS/MSI, Linux x64 AppImage/DEB, and Linux ARM64 AppImage/DEB succeed.
- [ ] Inspect generated release notes and architecture-specific filenames.
- [ ] Download and install at least the required x64/Apple Silicon packages on representative real machines before broad announcement.
- [ ] If signing secrets are absent, explicitly describe the macOS Gatekeeper and Windows SmartScreen warnings.

```sh
version=0.1.0
git tag -a "v$version" -m "OpenPDF $version"
git push origin "v$version"
```

The manual workflow trigger rebuilds an existing tag; it does not release untagged branch contents. Reruns reuse the draft and replace assets with the same names. Do not manually publish a draft whose required matrix is incomplete.

## Signing and notarization

No paid service is required for initial artifacts. Without secrets, macOS uses Tauri’s `-` ad-hoc identity. This avoids an entirely unsigned Apple Silicon bundle but does not establish developer identity or notarization; Gatekeeper may still require user approval.

For production macOS distribution, configure all applicable repository/environment secrets:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`: optional exact identity; the workflow otherwise discovers the imported Developer ID identity
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`: notarization credentials, configured as a complete set

Tauri notarizes when the Apple credential variables are present. Verify the resulting app with `codesign --verify --deep --strict`, `spctl --assess`, and `xcrun stapler validate` on a downloaded artifact before claiming notarization.

Windows remains unsigned unless these optional secrets are configured:

- `WINDOWS_CERTIFICATE`: base64-encoded Authenticode PFX
- `WINDOWS_CERTIFICATE_PASSWORD`
- `WINDOWS_TIMESTAMP_URL`: optional; defaults to DigiCert’s timestamp service

The workflow imports the PFX and passes its thumbprint to Tauri. Validate signed outputs with `Get-AuthenticodeSignature`. Never describe an unsigned build as trusted; SmartScreen reputation is separate from signature validity.

## Package and runtime QA

Automated release verification checks:

- platform executable architecture from Mach-O, PE, or ELF headers;
- ad-hoc or Developer ID integrity of the macOS `.app` and presence of its DMG;
- presence of distinct NSIS `.exe` and MSI installers;
- AppImage architecture and Debian `Architecture` metadata;
- fixture load, edit, export, filesystem save, and reopen on every build runner;
- native Rust safe-write tests on every target.

Before publishing release announcements, manually test open, render, edit, save, reopen, native dialogs, file association behavior, and uninstall where applicable. Linux AppImages should be tried on more than one supported distribution; an Ubuntu CI startup does not prove universal distribution compatibility.
