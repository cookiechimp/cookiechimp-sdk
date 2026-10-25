# GPP US section conformance

The SDK implements the US national section and 20 state sections, IDs 7 through
27. `approach: "state"` selects the supplied state's own format; unknown US
regions use national. `approach: "national"` explicitly selects national.

## Existing reference coverage

The pinned development-only `@iabgpp/cmpapi` 3.2.0 package covers IDs 7 through
22. Tests retain byte-identical encoding/decoding for 200 seeded value sets per
section, every pair, all 16 reference sections, GPC presence/absence, publisher
assertions, fail-closed choices and inherited-key rejection. It is not shipped
in the SDK runtime.

## Minnesota, Maryland, Indiana, Kentucky and Rhode Island

The five additional formats use the official specifications at
[IAB revision 03fdf033](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/tree/03fdf0332d261ee896b77d7f9a10edde1498fc7c/Sections/US-States).

| Section | ID | Encoding |
|---|---:|---|
| usmn | 23 | Existing core with eight sensitive-data values and an optional GPC subsection |
| usmd | 24 | Required section header, MSPA core, optional GPC subsection |
| usin | 25 | Required section header, MSPA core, optional eight-value sensitive-data subsection |
| usky | 26 | Required section header, MSPA core, optional eight-value sensitive-data subsection |
| usri | 27 | Required section header, MSPA core, optional eight-value sensitive-data subsection |

The April 2026 headers list additional subsection ID 1 only when included. Core
subsection zero is implicit and never listed. Header, core and optional subsection
are dot-separated and use six-bit padding as specified in the
[shared encoding rules](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/blob/03fdf0332d261ee896b77d7f9a10edde1498fc7c/Core/Consent%20String%20Specification.md).
The established older sections retain byte-padding compatibility with the
published reference; their default encodings do not change.

`MspaVersion` defaults to 1. Applications supply `MspaMode`, notices and other
publisher assertions. `GpcSegmentIncluded: false` or
`SensitiveDataConsentSegmentIncluded: false` omits the respective optional
subsection. Omission is reported by `getSection` and `getField`. GPC always
forces runtime sale/targeted-advertising opt-outs, including in formats without
a dedicated GPC subsection.

The published reference package cannot independently validate these five formats.
The upstream development reference at
[fd0546e7](https://github.com/IABTechLab/iabgpp-es/tree/fd0546e7b28e7e186bc27aac6375e6c10a80e47e/modules/cmpapi)
contains new-state cores but omits the required April 2026 section headers. The
SDK follows the pinned specifications, and rejects headerless MD/IN/KY/RI input.
Do not mistake that unpublished encoding for the specified wire format.

Twenty-five fixed vectors are generated independently with integer packing from
the pinned field tables in `scripts/generate-gpp-2026-vectors.py`. Tests check
exact bytes, reverse decoding, omitted subsections, array widths, MSPA assertions,
wrong jurisdiction/version headers, malformed or undeclared subsections, padding,
and invalid values. Regenerate with:

```sh
python3 scripts/generate-gpp-2026-vectors.py
pnpm exec biome format --write packages/core/src/fixtures/gpp-2026-vectors.json
```

Browser tests cover all five states' own API IDs, acceptance/rejection, reload
persistence and GPC after acceptance and reload. Existing stub, event-order and
cross-frame coverage remains. The opt-in GPP graph measures 3187 B against its
proposed 3680 B budget; the combined TCF/GPP graph remains within its unchanged
12288 B cap. The default core bundle is unchanged.

These checks establish encoding and runtime behavior, not legal applicability
or IAB certification. Optional managed integration remains in the
[internal TODO](iab-integration-todo.md).
