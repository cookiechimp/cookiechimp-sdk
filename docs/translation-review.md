# Translation editorial review (17 Oct 2026)

All 33 base and TCF UI label sets were reviewed by Codex at Daniel's request.
The review is recorded as `ai-editorial`, not as native-speaker review or
certification. The `reviewed` flag means the editorial review is complete.

The pass covered all 1,749 strings (22 base and 31 TCF keys per locale): meaning
against English, accept/reject intent, consent terminology, natural UI wording,
numeric durations, Unicode, placeholders and RTL language copy. Arabic and Hebrew
remain RTL. This string review does not claim a new visual accessibility audit.

## Corrections

- Make the Latvian rejection button reject optional cookies, rather than choices.
- Clarify the Hebrew rejection button as optional cookies, rather than files.
- Correct the Irish saved confirmation and empty vendor-search result.
- Align German/Dutch special-feature terms, Bulgarian legitimate-interest labels,
  Danish acceptance spelling, Japanese consent grammar and Maltese search wording.
- Remove unsupported extra benefit claims from German/French/Spanish category copy.
- Clarify Spanish sale/sharing wording, Romanian optional-cookie wording, Finnish
  device-access wording and the Korean Global Privacy Control signal.
- Use quantity-neutral day labels where numeric singular/plural forms differ,
  retaining exactly one `{days}` placeholder. Invariant units stay unchanged.
- Keep the React default English TCF labels aligned with the English locale.

## Evidence

[review.json](../packages/translations/review.json) records the reviewer, method,
date, exact SHA-256 for every reviewed source file and every corrected label.
The translation tests compare those hashes to the current files so later edits
cannot silently inherit the old reviewed status. A later editor must review the
changed copy and update the evidence. Automated key checks alone are not a review.

`localeMeta` and `tcfReviewedLocales` mark every locale reviewed;
`translationReview` exposes the review method and date from the metadata entry.

| Locale | Base | TCF | Source files |
|---|---|---|---|
| en | Editorial review complete | Editorial review complete | [base](../packages/translations/src/en.ts), [TCF](../packages/translations/src/tcf/en.ts) |
| de | Editorial review complete | Editorial review complete | [base](../packages/translations/src/de.ts), [TCF](../packages/translations/src/tcf/de.ts) |
| fr | Editorial review complete | Editorial review complete | [base](../packages/translations/src/fr.ts), [TCF](../packages/translations/src/tcf/fr.ts) |
| es | Editorial review complete | Editorial review complete | [base](../packages/translations/src/es.ts), [TCF](../packages/translations/src/tcf/es.ts) |
| it | Editorial review complete | Editorial review complete | [base](../packages/translations/src/it.ts), [TCF](../packages/translations/src/tcf/it.ts) |
| nl | Editorial review complete | Editorial review complete | [base](../packages/translations/src/nl.ts), [TCF](../packages/translations/src/tcf/nl.ts) |
| pt | Editorial review complete | Editorial review complete | [base](../packages/translations/src/pt.ts), [TCF](../packages/translations/src/tcf/pt.ts) |
| pt-BR | Editorial review complete | Editorial review complete | [base](../packages/translations/src/pt-BR.ts), [TCF](../packages/translations/src/tcf/pt-BR.ts) |
| pl | Editorial review complete | Editorial review complete | [base](../packages/translations/src/pl.ts), [TCF](../packages/translations/src/tcf/pl.ts) |
| sv | Editorial review complete | Editorial review complete | [base](../packages/translations/src/sv.ts), [TCF](../packages/translations/src/tcf/sv.ts) |
| da | Editorial review complete | Editorial review complete | [base](../packages/translations/src/da.ts), [TCF](../packages/translations/src/tcf/da.ts) |
| fi | Editorial review complete | Editorial review complete | [base](../packages/translations/src/fi.ts), [TCF](../packages/translations/src/tcf/fi.ts) |
| no | Editorial review complete | Editorial review complete | [base](../packages/translations/src/no.ts), [TCF](../packages/translations/src/tcf/no.ts) |
| cs | Editorial review complete | Editorial review complete | [base](../packages/translations/src/cs.ts), [TCF](../packages/translations/src/tcf/cs.ts) |
| sk | Editorial review complete | Editorial review complete | [base](../packages/translations/src/sk.ts), [TCF](../packages/translations/src/tcf/sk.ts) |
| hu | Editorial review complete | Editorial review complete | [base](../packages/translations/src/hu.ts), [TCF](../packages/translations/src/tcf/hu.ts) |
| ro | Editorial review complete | Editorial review complete | [base](../packages/translations/src/ro.ts), [TCF](../packages/translations/src/tcf/ro.ts) |
| bg | Editorial review complete | Editorial review complete | [base](../packages/translations/src/bg.ts), [TCF](../packages/translations/src/tcf/bg.ts) |
| el | Editorial review complete | Editorial review complete | [base](../packages/translations/src/el.ts), [TCF](../packages/translations/src/tcf/el.ts) |
| hr | Editorial review complete | Editorial review complete | [base](../packages/translations/src/hr.ts), [TCF](../packages/translations/src/tcf/hr.ts) |
| sl | Editorial review complete | Editorial review complete | [base](../packages/translations/src/sl.ts), [TCF](../packages/translations/src/tcf/sl.ts) |
| et | Editorial review complete | Editorial review complete | [base](../packages/translations/src/et.ts), [TCF](../packages/translations/src/tcf/et.ts) |
| lv | Editorial review complete | Editorial review complete | [base](../packages/translations/src/lv.ts), [TCF](../packages/translations/src/tcf/lv.ts) |
| lt | Editorial review complete | Editorial review complete | [base](../packages/translations/src/lt.ts), [TCF](../packages/translations/src/tcf/lt.ts) |
| ga | Editorial review complete | Editorial review complete | [base](../packages/translations/src/ga.ts), [TCF](../packages/translations/src/tcf/ga.ts) |
| mt | Editorial review complete | Editorial review complete | [base](../packages/translations/src/mt.ts), [TCF](../packages/translations/src/tcf/mt.ts) |
| tr | Editorial review complete | Editorial review complete | [base](../packages/translations/src/tr.ts), [TCF](../packages/translations/src/tcf/tr.ts) |
| ja | Editorial review complete | Editorial review complete | [base](../packages/translations/src/ja.ts), [TCF](../packages/translations/src/tcf/ja.ts) |
| zh | Editorial review complete | Editorial review complete | [base](../packages/translations/src/zh.ts), [TCF](../packages/translations/src/tcf/zh.ts) |
| ko | Editorial review complete | Editorial review complete | [base](../packages/translations/src/ko.ts), [TCF](../packages/translations/src/tcf/ko.ts) |
| ar | Editorial review complete | Editorial review complete | [base](../packages/translations/src/ar.ts), [TCF](../packages/translations/src/tcf/ar.ts) |
| he | Editorial review complete | Editorial review complete | [base](../packages/translations/src/he.ts), [TCF](../packages/translations/src/tcf/he.ts) |
| uk | Editorial review complete | Editorial review complete | [base](../packages/translations/src/uk.ts), [TCF](../packages/translations/src/tcf/uk.ts) |
