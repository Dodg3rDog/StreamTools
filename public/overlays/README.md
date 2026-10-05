# StreamTools Overlays

This folder is for OBS/browser-source overlays served by the StreamTools web server.

Repo-safe overlays can live directly in this folder or in named subfolders.

Unless an overlay has a specific reason to use another size, design OBS/browser-source overlays for a default canvas of:

```text
1920x1080 px
```

Overlay-specific offsets, padding, and layout fixes should stay inside that overlay's own folder so they do not affect unrelated overlays.

Purchased or otherwise non-redistributable overlays should go in:

```text
public/overlays/purchased/
```

That folder is intentionally ignored by git, but it is still available to the local StreamTools server at:

```text
/overlays/purchased/<overlay-folder>/
```
