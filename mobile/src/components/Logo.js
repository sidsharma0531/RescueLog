import { Image } from 'react-native';

// The real RescueLog mark — the exact same asset as the iOS/Android app icon
// (assets/icon.png), so the in-app logo always matches the home-screen icon
// and the dashboard branding. Same `size` prop API as before, so call sites
// are unchanged; corner radius matches the app-icon look.
const ICON = require('../../assets/icon.png');

export default function Logo({ size = 60 }) {
  return (
    <Image
      source={ICON}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
      accessibilityIgnoresInvertColors
    />
  );
}
