# Farmer reference-data Amharic follow-up

**Status:** Partially addressed in Farmer mobile polish (2026-07-17)  
**Priority:** Small follow-up; does not block the next platform phase

## Goal

Display localized labels for reference/master data in Farmer app dropdowns,
pickers, chips, and selection lists.

## Fixed in this polish pass

1. **Language toggle** — Home and Login now show `አማ` in Amharic mode and `EN` in English mode.
2. **New listing geo chips** — woreda / washing station / cooperative use `am` when
   language is Amharic (`NewListingScreen.js` no longer forces `lang = 'en'`).
3. **Profile spoken-language chips** — same `lang` fix in Profile / ProfileSetup.
4. **Farm / cycle chips** — Farm activity and harvest forms prefer `nameAm`.
5. **Product displays** — Inventory balances and harvest detail lines prefer
   `productNameAm` in Amharic mode.

## Remaining (optional / later)

- Free-text zone/woreda on profile and farm forms (not bilingual chip catalogs).
- Geography master API / cooperative Amharic fields (platform roadmap).
- Shared `localizedName(...)` helper adoption across all chip rows.

## Verification

1. Toggle language on Home/Login: label switches between `አማ` and `EN`.
2. New listing in Amharic: woreda / station / coop chips show Amharic labels.
3. Activity / harvest forms: farms and cycles with `nameAm` display Amharic.
4. Inventory balances and harvest detail: Amharic product names when available.
