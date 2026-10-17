# TCF disclosure preparation (13 Oct 2026)

The TCF v2.4 specifications add `standardTexts.features` and feature illustrations
to the GVL. IAB Europe confirmed 23 October 2026 as the web disclosure deadline,
and 23 February 2027 for mobile/CTV. The SDK preserves and displays these fields,
plus existing descriptions and illustrations for other disclosure types. It uses
the supplied GVL terms and renders text, never raw HTML. Ordinary features have
no choice controls; special features retain their opt-in controls.

Verification: a live read of the official GVL (version 180, policy 5) retained all
30 named records' descriptions/illustrations and the feature explanation exactly.
All 1226 vendors parsed. Local unit/component and production desktop/mobile browser
checks cover bounded untrusted fields, safe rendering, keyboard expansion and
special-purpose-only vendor disclosure without fabricated consent/LI signals.
No real CMP ID, active membership, manual-validator approval or platform entitlement
was inferred from these checks.

The supplier must use current official GVL translations for the chosen language.
If an application persists choices across devices, it must also explain that scope
and handle conflicts in its account logic. The SDK does not provide account consent
synchronization or a GVL CDN. CookieChimp-managed TCF activation is deferred to
the [internal IAB TODO](iab-integration-todo.md). Registration and validation are
prerequisites for that activation, rather than for publishing the ordinary SDK.

Sources: [IAB confirmed timeline](https://iabeurope.eu/wp-content/uploads/TCF_V-CMP_comms_TCFpoliciesV5.0.bAndSpecificationsV2.4ConfirmationOf-theTimeline_160726_IABEurope.pdf),
[TCF specifications](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20Consent%20string%20and%20vendor%20list%20formats%20v2.md),
[current GVL](https://vendor-list.consensu.org/v3/vendor-list.json).
