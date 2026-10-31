---
"@cookiechimp/react-native": patch
---

A vendor that consent does not allow now gets `onStop` as soon as it registers. Firebase, Mixpanel, AppsFlyer and most other vendor SDKs keep their last setting across launches, so a vendor that ran on an earlier launch kept collecting after consent expired or re-consent was required, even when the user then rejected it.
