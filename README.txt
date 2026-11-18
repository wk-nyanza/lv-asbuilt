WK LV AS-BUILT — NYANZA (installable phone app / PWA)
=====================================================
Created by Ir Wilbert KIRARA, Expert Surveyor in Electrical Power Lines.
(c) 2026 Ir Wilbert KIRARA. All rights reserved.
Project: Design, supply, and installation of low voltage and medium voltage lines
and service connections in Nyanza (EPC Nyanza, JV REAL/PATRONICS, EDCL).
Field engine: Voltline (same author), adapted to Nyanza.

FILES (keep them together, all of them)
- index.html ........... the field app (phones)
- tracker.html ......... supervisor console (computer): merge send files, issues, totals
- app.js ............... app logic
- nyanza-customers.js .. Phase 1 customer lists, 1,886 customers on 22 transformers
- nyanza-transformers.js 141 transformers of the Nyanza LV design (TM Rwanda)
- nyanza-villages.js ... official NISR village boundaries, Nyanza + 2 km
- exceljs, jszip, zxing, ocr/ (ID reader), nyanza-template.xlsx, apps-script/Code.gs (sync server)
- leaflet/, sw.js, manifest.webmanifest, icons

WHAT IT RECORDS
- Transformer point (photo required), poles (photo required), customers.
- Spans are derived: each pole says which pole (or the transformer) it is fed from;
  span length and geometry come from the two GPS points.
- Customer: picked from the Phase 1 list of the transformer (name, meter, ID, UPI,
  phone filled in), GPS taken at the meter, supply pole chosen; service cable length
  = GPS distance pole -> house + drop allowance (Setup, default 6 m).
- Pole number and cable length written in the EUCL list are kept beside the field
  values (Pole_in_list, Length_in_list) and differences are flagged in Send > Check.

VERSION 2 (WK Connect method, design and tools)
- WK Connect design: dark header, live GPS bar (SAT / NET + accuracy) on every screen.
- Every point is CAPTURED like in WK Connect: satellite fixes only, averaged, outliers removed,
  stops at ±3 m after 15 fixes, after 60 s, or on "Use now". The point is cleared after each save,
  so two poles can never get the same coordinates by mistake; a point < 3 m from another point of
  the same kind asks for confirmation.
- Photos kept at full size (1600 px) and stamped on export / sync with number, name or meter,
  X/Y, precision, village, date and agent.
- Automatic sync to a Google Sheet (tabs Transformers / Poles / Customers) + Drive photo folder
  per transformer (apps-script/Code.gs). Header chip: ☁ ✓ synced · ☁ n waiting · ☁ ! error.
- Excel report of the customers in the RESERVE format (Nyanza template).
- Complete package now also contains backup.json + original photos: "Restore" puts everything
  back on any phone (ZIP) — a send file (.wklv.json) can be restored too (without photos).
- Barcode / QR scan for meter number, ID and UPI; ID-card reader (offline OCR) for customers
  not on the list; customer last names forced to CAPITALS.

NYANZA-SPECIFIC
- Setup: Sector -> Transformer. Transformers with a customer list are listed first.
- Pole numbers restart on every transformer (P1, P2 ...). A pole is identified by
  its number INSIDE its transformer, in the app, the checks, the exports and the tracker.
- District / Sector / Cell / Village of every point come from its GPS position
  (NISR boundaries). Cell / Village in Setup are only a fallback outside the map.
- After a GPS fix the nearest design transformer is proposed ("Use it").
- Satellite map shows village boundaries + names and the 141 design transformers.
- GPS: once a satellite fix is received, Wi-Fi / mobile-network positions are
  ignored. The accuracy box shows SAT or NET.
- Customer last names are stored in CAPITALS.
- Coordinates: ITRF2005 / TM Rwanda (CM 30E, k0 0.9999, FE 500000, FN 5000000, GRS80).

EXPORTS (Send tab)
- Send file (.wklv.json) -> supervisor, every evening. Drop it into tracker.html.
- Complete package ZIP: KMZ with photos, shapefiles (Transformer, Poles, LV_Network,
  Customers, Service_Cable; .prj TM Rwanda), CSV tables, photos.
- Customer list — Nyanza format: NO, Pole N0, HOUSE NO, Real length, NAME, SURNAME,
  Village, CELL, SECTOR, CATEGORY, PHASE, ID, Meter Number, UPI/No Parcel, Telephone,
  Transformer, X, Y, Pole in list, Cable in list.

CUSTOMER LISTS -> TRANSFORMERS (check these)
- 29 workbooks read; Kamabuye and Kamabuye(Muyenzi) are the same list (duplicates removed);
  list 1 + list 2 merged per transformer; duplicates by meter number removed.
- "Customer List Birembo Village" header says TRANSFORMER MWANABERI -> put on EX TRF MWANABERI
  (EX TRF BIREMBO also exists in the design: move it if Birembo is fed from there).
- KABEZA (Mututu cell, Kibilizi): the design EX_TRF_KABEZA lies in Kabeza village of
  Cyabakamyi sector, another village -> kept as its own transformer "TRF Kabeza (Mututu)".
- MATARA list has no transformer name and none of the design transformers is called Matara
  -> kept as "TRF Matara" (Kibilizi), no design position.
- To refresh the lists: regenerate nyanza-customers.js and bump CACHE in sw.js.

ONLINE: https://wk-nyanza.github.io/lv-asbuilt/  (tracker: .../tracker.html)
Repository wk-nyanza/lv-asbuilt (GitHub Pages, main / root). Bump CACHE in sw.js on every release.
WARNING: on a public repository, nyanza-customers.js (names, national IDs, phones) can be
downloaded by anyone who finds the address.
WARNING: WK Connect Survey and Voltline on the same github.io address delete the other apps'
offline caches when they update (their sw.js removes every cache that is not theirs).
Fix their sw.js to delete only their own cache names, or host this app on another address.

ON EACH PHONE
- Open the link in Chrome with network, Install app, allow Location.
- Open once with network: afterwards it works offline.
- Before going out: map card > Offline map > Save map offline (with your area on screen).
