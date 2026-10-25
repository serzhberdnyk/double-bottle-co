# Double Bottle public source v0.8.3

This v0.8.3 public-source update applies the reviewed 18-file program-route correction to public commit `7c526a5f9db1a20063f19e10ae6c05723da1ff66`. It corresponds to the application changes released as Sites107. See [CHANGELOG.md](CHANGELOG.md).

This is sanitized public source, not a production backup or deployable copy of the live Site. The reviewed v0.8.1 export was published in this repository; subsequent updates retain its synthetic data, empty exported translation maps, DEMO brochures, bundled license notices and privacy exclusions. No production media, catalog rows or private project history are imported by this update. No blanket project OSS license is assigned.

The original v0.8.1 audit reports (`PUBLIC-CANDIDATE-VALIDATION.json`, `SOURCE-PROVENANCE.json`, `ASSET-DECISIONS.json` and `ASSET-REVIEW.json`) remain historical review records. Their prepublication status and earlier test results are not the status or test results of v0.8.3. `EXPORT-MANIFEST.json` describes the current distributed files.

## Supported local setup

Use Node >=22.13.0 and pinned pnpm 11.25.0 on supported Linux. Install with `pnpm install --frozen-lockfile`. Review lifecycle scripts before enabling them. Validation used a fresh frozen offline install from a matching local package cache with lifecycle scripts disabled, 640 packages reused and zero downloads. The final correction uses those same installed versions; package and lockfile bytes are unchanged.

`pnpm build` builds locally and does not deploy. `pnpm dev` is only for a separate local environment. Never connect this candidate to the live Site or production database. `.openai/hosting.json` has no live project identity.

Example env files contain placeholders. A local D1 database needs migrations from `drizzle/`. No production rows, enquiries, sessions, private imports, supplier snapshots, backups or uploads are supplied. Do not run seed, import, restore or publication scripts against production. Historical scripts referring to excluded private inputs are not part of the supported public validation flow.

## Synthetic data contract

Approved-program JSON and test JSON contain artificial content and amounts. Structural lookup keys, schema enums, currencies, date syntax and foreign-key relationships are retained or reconstructed from application contracts, not from omitted private data. These fixtures are not current tours, offers, prices or approved production copy.

The public catalog fixture has 43 synthetic tours, 64 variants and 13 destinations. Its generation field matches the fixture contract, not a live deployment. The small `tests/fixtures/sanitized-import-packet.json` provides three synthetic existing products for importer tests. It does not reconstruct the private catalog.

Both exported translation snapshot dictionaries remain empty. Built-in source dictionaries still work. Missing exact phrases remain unready for EN/TH public views; no automatic translation or silent Russian fallback is introduced.

## DEMO brochure substitution

All sixteen `public/media/atime-*.jpg` paths now contain original, simple, clearly marked DEMO placeholders. The original operator JPEG bytes are omitted from this export, not licensed by inference. Every replacement says it is synthetic, not an offer, and contains no operator artwork. All sixteen decode as 1000x1400 JPEG and use identical pixels. No original brochure SHA256 occurs anywhere among the planned distributed files, regardless of filename.

`assets-source/demo-brochure-placeholder.svg` is the new code-native artwork. `node scripts/render-demo-brochures.mjs` renders it to the existing sixteen filenames using the pinned Next/sharp dependency. The renderer reads no operator image. It writes only those sixteen public-copy files.

The v0.8.1 export-specific brochure sanitization changes are:

* `app/components/ApprovedBrochures.tsx`: RU/EN/TH display labels explicitly identify DEMO samples. Existing product mappings and all sixteen links are unchanged.
* `lib/server/approved-eight-import.ts`: the new-product `imageAlt` literal identifies a DEMO synthetic sample; new media `license`, `attribution` and `sourceUrl` identify synthetic export placeholders, not original A-Time brochures.

Those brochure substitutions did not change IDs, structural stems, slugs, guards, rates, SQL or importer control flow. Subsequent code changes are listed separately in the changelog. Historical supplier/provenance strings remain code identifiers and do not establish rights to omitted artwork. The original export archive and original candidate were not changed.

## Validation

### v0.8.3 public-source update

The release executor confirmed 38/38 focused tests, TypeScript and production build PASS for the exact published Sites107 source. That existing evidence is reused for this code synchronization; a new full cloud build, full historical suite and browser/pixel QA are not claimed. The 18-file patch is checked against exact preimage/postimage hashes before application. The public copy retains synthetic fixtures and DEMO substitutions rather than importing production data.

The cloud synchronization additionally passed 6 program-binding tests, 11 synthetic export/import tests and 4 DEMO component tests on this exact sanitized source. All 18 patch preimages and postimages matched; no source reconciliation or security-guard changes were needed.

### Historical v0.8.2 public-source validation

Repeated on the final patched Linux public-source copy with the unchanged pinned dependencies: production build PASS, TypeScript PASS, 62 focused card/map/contact tests PASS, 12 localization tests PASS, 4 DEMO component tests PASS and 11 synthetic export/import tests PASS. The latter export-only suite must run from a clean source archive without `.git`; running it directly inside a Git checkout intentionally fails its archive-content assertion. No test or security guard was disabled.

All 28 patch preimages and postimages matched the reviewed package exactly. All media, data fixtures, font binaries, license notices, package/lock files and other code outside the patch remain unchanged. Changed-source lint reports the same 5 existing CatalogUI errors and 10 warnings as the reviewed patch, with zero new diagnostics. This is not a clean full-repository lint result. The full historical suite and browser/pixel QA were NOT rerun for v0.8.2.

### Historical v0.8.1 export validation

On Linux with installed dependencies:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-loader ./tests/visibility-route-loader.mjs --test tests/sanitized-candidate.test.ts
node --test tests/demo-brochures.test.mjs
node --test scripts/test-catalog-localization.cjs
python3 tests/release-ownership.test.py
node node_modules/eslint/bin/eslint.js app/components/ApprovedBrochures.tsx tests/sanitized-candidate.test.ts tests/demo-brochures.test.mjs scripts/render-demo-brochures.mjs
pnpm build
python3 scripts/subset-public-nimbus.py --check
```

The final license/DEMO correction passed Linux production build, TypeScript, 11 synthetic import contract tests, 4 real-component SSR tests, 12 localization tests, 8 release ownership tests and the focused lint command above. Separate importer lint found one existing `no-explicit-any` error and one existing unused-import warning. Its diagnostics match the prior file exactly; there are zero new findings. This is not a full repository lint pass.

The full historical Node suite was NOT rerun on this final export. On previous candidate commit `97831dffe21e3161aa92487bcfcefcc4e7f7f866` it had 314 tests, 227 passed and 87 failed. Those are historical results, not results for the final commit. The 87 failures comprised 30 excluded private-fixture cases, 3 excluded historical-document cases, 4 dataset-specific golden assertions, 14 outdated SQL fixtures, 15 stale UI mocks and 21 historical assertions needing separate review. No guards or tests were disabled to conceal failures. See `PUBLIC-CANDIDATE-VALIDATION.json`.

That historical export validation performed no live database access, credential use, remote deployment, browser validation, GitHub write or access change. These GitHub synchronizations update public source only; they do not deploy this synthetic copy to a Site or touch a live database.

## Privacy, retained assets and licenses

Five private-import datasets and historical operational documents remain excluded. One additional operational screenshot, `docs/qa/elysiam-form-success.jpg`, is excluded because it visibly contains an enquiry reference whose synthetic provenance was not established. The reference value is not recorded. Its original archive copy remains unchanged.

The three user-supplied Cheow-Lan PNGs, CC photographs, OSM resources, Prata font and own project illustrations are retained under the established owner/reviewer provenance and their applicable bundled notices. They are byte-identical to the previous candidate. Consult `ASSET-DECISIONS.json`, `ASSET-REVIEW.json`, `content/media-credits.json`, `content/cheow-lan-map-provenance.json`, `docs/asset-provenance.json` and bundled third-party notices. Unlabeled inventory is not a count of rights violations. This review does not create unrelated third-party rights or a project-wide license.

Roboto Condensed Version 3.008 carries the official version-matching Apache-2.0 notice in `public/fonts/reference/RobotoCondensed-Apache-2.0.txt`. The incorrect OFL sidecar was removed. Both WOFF binaries are unchanged. Prata retains its OFL notice.

The three Nimbus source OTFs and exact source/output mapping are bundled in `vendor/urw-base35/`. The standalone subset recipe was verified with Python 3.12.14 and fontTools 4.61.1: all three distributed WOFF subsets reproduce byte-for-byte. The existing complete AGPL text and font exception in `public/fonts/LICENSE.txt` are unchanged. Font-specific terms are not a project-wide license grant.

`public/VERCEL-MIT-NOTICE.txt` covers the unchanged create-next-app template SVGs `file.svg`, `globe.svg` and `window.svg`. The notice matches official source bytes and the installed Next package. Official source URLs and immutable blob hashes are in `ASSET-DECISIONS.json`.

Fifty PNG text metadata chunks are identical software markers. Five PNG C2PA chunks contain generation and signing provenance; these are not automatically secrets. Pattern checks and this bounded review are not a complete forensic audit of all binary formats.

`SOURCE-PROVENANCE.json` records the original export exclusions and transformations. `EXPORT-MANIFEST.json` lists every currently distributed file except itself. The source export excludes node_modules, build outputs, local state, raw audit logs and private project history. This repository preserves its existing clean public history when adding release commits.
