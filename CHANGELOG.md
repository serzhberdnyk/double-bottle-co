# Changelog

## v0.8.3 · 2026-10-25

Public-source synchronization of the reviewed 18-file correction released as Sites107.

* The bottle logo is shifted upward by 3 px in CSS.
* Program routes are no longer displayed on the general public map.
* Program-route bindings use both stable tour and variant IDs, rather than a tour-only association.
* The editor can use the full administrative catalog when choosing program bindings; public visibility remains a separate concern.
* The release executor confirmed 38/38 focused tests, TypeScript and build PASS on the exact published source. This synchronization reuses that evidence and does not claim a new full build, historical-suite pass or browser/pixel QA.
* An additional bounded check of the sanitized copy passed 6 program-binding, 11 synthetic export/import and 4 DEMO component tests. All 18 patch preimages and postimages matched exactly.
* Only the code/test delta and release documentation/manifest are synchronized. All production data remains excluded; synthetic JSON, DEMO brochures, license notices and clean public history are retained.

## v0.8.2 · 2026-10-25

Public-source synchronization of the reviewed card, map and contact-button update.

### Changed

* Tour cards align current adult and child amounts across each row, retain complete titles and age conditions, and keep discounts in separate slots. Existing price calculations and rate data are unchanged.
* Map route points support optional names and six readable colors. Direct drag, touch and keyboard movement remain available; numeric coordinate inputs are removed from the editor UI.
* Save and publish validates the current editor payload and publishes it atomically. Authentication, same-origin, request-size, map-revision and catalog-generation guards remain enforced. Failed or stale requests do not publish an older draft.
* Late initial loads no longer overwrite newer editor changes. Repeated publication clicks are guarded; failed saves retain dirty edits, and refreshing dirty edits requires confirmation.
* Routes may be linked to a tour by stable product ID or left unassigned. Public detail pages show only their linked routes. Hidden, deleted or locale-unready tours are not exposed through the public map.
* Routes may be closed when they contain at least three distinct points. Closure adds a rendered final segment, not a duplicate stored point. Reverse and delete operations preserve point metadata and safely reopen underspecified routes.
* The main hero button uses Contact us wording in RU, EN and TH and opens the existing contact modal.

### Public export and verification

* Exactly 28 reviewed code/test files were applied without reconciliation. README and this changelog document the update; the file manifest is refreshed.
* Synthetic fixtures, empty exported translation dictionaries, all sixteen DEMO brochure images and their truthful metadata, asset notices and privacy exclusions are retained. No production data, proprietary brochure bytes or private history are imported.
* Linux build, TypeScript, 62 focused card/map/contact tests, 12 localization tests, 4 DEMO component tests and 11 clean-export synthetic tests passed.
* Changed-source lint has zero new diagnostics; 5 pre-existing CatalogUI errors and 10 warnings remain. The full historical test suite and browser/pixel QA were not rerun. Earlier 87-failure results in the audit reports belong to an older review candidate, not this release.
* This is a source update, not a deployment of the sanitized public copy. No project-wide open-source license is added.

## v0.8.1 public source · 2026-10-25

Initial independently reviewed, sanitized public source was published at commit `78db1725e9c39f456edc032dab1dfb7d5b8e1957`. It includes synthetic data contracts, DEMO brochure substitutions, applicable font/template notices and the retained clean public history. Original production/private history is not included. Detailed validation limitations and asset decisions are preserved in the historical audit reports and README.
