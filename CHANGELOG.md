# Changelog

| Version | Date | Changes |
| --- | --- | --- |
| 1.1.0 | 2026-11-15 | GitHub Pages deployment support: build is basePath-aware (`NEXT_PUBLIC_BASE_PATH`, set in `.github/workflows/deploy-pages.yml`), pdf.js worker URLs honor it, `deploy-pages.yml` workflow publishes `out/` on push to main, `.nojekyll` added. Cloudflare / custom-domain / root-repo builds are unchanged (unset → root). No editor changes. |
| 1.0.0 | 2026-11-15 | First release. Full in-browser PDF editor: text (12 standard fonts), signature pad, white-out with rasterize-for-redaction, highlighter, rectangle/ellipse/line/pen, image stamps, AcroForm filling (text/checkbox/dropdown/radio), page rotate/delete/blank-insert, unlimited undo/redo, vector + rasterized export, mobile and dark mode. 100% client-side; pdf.js workers vendored; no CDN, no paid services. |
