# Desktop installation and Windows friend installer

Owner wants BillZen installed on this Linux desktop and an installer to share with a Windows friend. Assume Windows x64; label actual artifact architecture. Keep existing business data untouched. No updater/signing identity changes or automatic public release upload.

1. Install the already verified Linux executable to the user's local application directory, install the existing icon and a validated desktop entry. Compare installed executable hash; preserve `~/.local/share/billzen` data.
2. Add a manually dispatched Windows x64 installer workflow using existing npm/Cargo locks and the Tauri NSIS bundler. Use hosted Windows, cache dependencies, retain installer plus checksums/provenance as workflow artifacts. No production signing inputs in this build; report unsigned status honestly.
3. Commit/push workflow/docs on authorized main and dispatch it. Inspect actual run; fix compilation issues if found. Download successful artifact to ignored local output, verify checksum/package file type, and provide its exact path. A build pass is not a physical Windows runtime test.
4. Update second brain/verification with actual Linux install and Windows delivery status. GitHub publication and desktop automatic updates remain separate actions.
