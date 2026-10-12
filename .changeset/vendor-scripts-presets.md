---
"@cookiechimp/scripts": minor
---

Add opt-in presets for Meta Pixel, Microsoft Clarity, PostHog, Segment, Hotjar, LinkedIn Insight and TikTok Pixel, each on its own subpath.

Each vendor preset has `sync(consent)`, which follows its category and calls the vendor's consent API on revoke and grant (Meta `fbq('consent')`, Clarity `clarity('consent')`, PostHog `opt_out_capturing` and `opt_in_capturing`, TikTok `revokeConsent` and `grantConsent`). Calls made before the vendor script loads are queued. Segment, Hotjar and LinkedIn have no consent API: `preset.revoke` is `"reload"` for them, and a page reload is needed to stop code that already loaded.
