Notes 0.1.1: security hardening.

Fixed:
- The internet and network-state permissions are now blocked even if a library tries to add them.
- The build pins its tools to exact versions and deletes the signing key as soon as the build is done.
