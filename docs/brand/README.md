# BillZen identity

The app mark is the lime tile and dark Z from the README hero. The canonical vector is [`public/brand/billzen-icon.svg`](../../public/brand/billzen-icon.svg). It preserves the original banner mark's geometry and colors (`#c9ff79` / `#101b18`).

After editing the master, run:

```sh
npm run icons:generate
```

This uses the installed Tauri CLI to regenerate:

- Native PNG/ICO/ICNS and Windows Store assets in `src-tauri/icons/`.
- Android density variants and iOS app-icon sizes in the same directory.
- Browser favicon, Apple touch icon and 192/512 px web-manifest images.
- The matching inline mark inside `docs/brand/billzen-hero.svg`.

The application header references the canonical vector directly. Tauri's bundle configuration explicitly lists the native icons; its generated application context supplies the default window icon. Browser tags and the web manifest reference the matching web assets.

Mobile assets are prepared for future native projects. Android/iOS app scaffolding, build and device verification remain separate work; generating icons does not establish mobile application support. The web manifest provides name/icon metadata, not durable browser storage or an offline service worker.

Do not replace functional navigation icons or a merchant's invoice identity with the BillZen application mark. Refresh README screenshots/GIF after a visible branding change. Installed desktop launchers may keep an older cached icon until the updated package is installed and the app/session is restarted.
