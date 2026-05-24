import * as SecureStore from 'expo-secure-store';

// On-device state:
//   - the organization the user picked (persists across logouts; cleared
//     only by "Switch organization")
//   - the driver currently logged in (cleared on logout)

const ORG_KEY = 'rescuelog_org';
const DRIVER_KEY = 'rescuelog_driver';

async function readJson(key) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveOrg(org) {
  await SecureStore.setItemAsync(ORG_KEY, JSON.stringify(org));
}
export function getOrg() {
  return readJson(ORG_KEY);
}
export async function clearOrg() {
  await SecureStore.deleteItemAsync(ORG_KEY);
}

export async function saveDriver(driver) {
  await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(driver));
}
export function getDriver() {
  return readJson(DRIVER_KEY);
}
export async function clearDriver() {
  await SecureStore.deleteItemAsync(DRIVER_KEY);
}
