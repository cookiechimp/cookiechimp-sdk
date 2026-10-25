# React Native Expo example

A runnable Expo app for `@cookiechimp/react-native`. It shows the dashboard
banner and preferences, the current consent state and a log of vendor start and
stop callbacks.

This example is not part of the pnpm workspace, so CI does not install Expo.
Until the package is published, pack the local SDK into `vendor/` and install
the example with npm:

```bash
pnpm install
cd examples/react-native-expo
npm run pack-sdk
npm install
npx expo start
```

Open it in Expo Go, an iOS simulator or an Android emulator, or press `w` for
the web preview.

- Without configuration it runs in offline mode from `cookiechimp-config.json`,
  the sample platform bundle used by the SDK tests. With no region known, its
  default banner uses the GDPR fallback, so optional categories start off.
  Pass `country="US-CA"` to the provider to see the opt-out behavior.
- Set `EXPO_PUBLIC_COOKIECHIMP_ACCOUNT_ID=your_account_id` to load your live
  dashboard config and send consent records to CookieChimp.

Use "Reset consent" to see the first-launch flow again. Run
`npx expo export --platform ios --platform android` to check that Metro bundles
the SDK for Hermes.
