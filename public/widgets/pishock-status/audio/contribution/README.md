Drop viewer contribution audio variants in this folder.

The widget currently randomizes across:

- `rift-contribution_01.mp3` through `rift-contribution_17.mp3`

It also includes `../rift-contribution.mp3` as a fallback in the same random pool.

Browsers cannot list folder contents directly, so adding more files here also requires adding their URL to the `contribution.urls` list in `public/widgets/pishock-status/index.html`.
