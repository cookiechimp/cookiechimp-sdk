# GPP later-state conformance

The SDK encodes every US state section exposed by the currently published
`@iabgpp/cmpapi` 3.2.0 reference library: national plus 15 state formats.
The follow-up adds FL, MT, OR, TX, DE, IA, NE, NH, NJ and TN.

The test suite checks field order and scalar/array widths, 200 seeded value
sets per section, every pair of sections and a string containing all 16
sections. Encodings are byte-identical to the IAB library, and each decoder
round-trips the other implementation's output. Tests cover GPC segment presence
and absence, publisher assertions, fail-closed opt-outs and inherited-key rejection.

Browser tests exercise TX, NJ, IA and FL through the CMP API: correct section
IDs, no substituted national section, acceptance/rejection updates and consent
persistence after reload. Existing GPC, API event, stub and cross-frame tests remain.

No size budget changed. GPP is 2673 B of 2810 B, its stub is 859 B of 925 B,
and combined TCF/GPP is 10366 B of 12288 B. The default bundle is unchanged.
The IAB CMP registration and manual validation remain external prerequisites.

The current specification also lists newer MN, MD, IN, KY and RI formats
(IDs 23 to 27), which the published reference library does not yet implement.
They currently use the national fallback. This is an explicit coverage limit;
these tests do not certify legal applicability or every later specification.

Sources: [IAB section registry](https://github.com/InteractiveAdvertisingBureau/Global-Privacy-Platform/blob/main/Sections/Section%20Information.md)
and [IAB reference implementation](https://www.npmjs.com/package/@iabgpp/cmpapi).
