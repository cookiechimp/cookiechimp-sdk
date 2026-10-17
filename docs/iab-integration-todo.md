# Internal TODO: optional managed IAB integration

Owner: Daniel. Status: deferred on 17 Oct 2026.

- [ ] Complete the CMP registration process and record the assigned CMP ID.
- [ ] Replace the internal `cmpId: null` placeholder with that real assigned ID.
- [ ] Complete the current manual IAB validation and record its evidence.
- [ ] Review the GVL source and authoritative feature-access integration.
- [ ] Explicitly authorize production activation after those steps.

This TODO is tracked in `release/readiness.json` under `deferred.tcf`. It is
not a publication gate for the ordinary SDK packages. Do not mark registration
or validation complete to bypass a gate, invent an ID, or imply certification.
TCF stays opt-in and disabled by default; production rejects missing, zero or
invalid IDs. The SDK's runtime checks are unchanged.

This operational checklist is not exported to Mintlify. Public guides describe
configuration requirements without making claims about CookieChimp's registration
status. Keep this task separate from platform code and platform deployment.
