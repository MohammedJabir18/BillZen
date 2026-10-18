# Security

This development preview stores an unencrypted local SQLite database and has no implemented user-authentication or encrypted-backup workflow. Restrict OS account access and use synthetic data while developing.

Do not disclose credentials, customer records or exploitable details in public issues. Report a suspected security problem privately to the repository owner using an existing trusted contact channel. This document does not claim that GitHub private vulnerability reporting is enabled or that a dedicated security email exists.

Tauri capability and CSP configuration should be reviewed together with command input validation. The browser demonstration is not a security boundary for a production web product. Before release, test native permission denials, filesystem access, backup/restore validation and dependency updates on each target platform.
