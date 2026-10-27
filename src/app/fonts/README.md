Self-hosted so builds never depend on Google Fonts being reachable (a failed download broke a
production build and the dev server on 27.10.2026).

- `manrope-latin-cyrillic.woff2` — Manrope variable (weights 200–800), from github.com/google/fonts
  `ofl/manrope/Manrope[wght].ttf`, subset to Latin + Cyrillic with pyftsubset (woff2).
- `bad-script-latin-cyrillic.woff2` — Bad Script Regular, from `ofl/badscript/BadScript-Regular.ttf`,
  same subset.

Both are under the SIL Open Font License 1.1. Subset command:
`pyftsubset <font>.ttf --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2000-206F,U+20AC,U+2116,U+2122,U+2190-21FF,U+2212,U+2215,U+2248,U+2713,U+FEFF,U+FFFD" --flavor=woff2 --layout-features='*'`
