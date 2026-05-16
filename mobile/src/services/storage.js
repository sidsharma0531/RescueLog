import * as SecureStore from 'expo-secure-store';

// Persists the logged-in driver so the app skips the login screen on
// subsequent opens.
const DRIVER_KEY = 'rescuelog_driver';

export async function saveDriver(driver) {
  await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(driver));
}

export async function getDriver() {
  try {
    const raw = await SecureStore.getItemAsync(DRIVER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearDriver() {
  await SecureStore.deleteItemAsync(DRIVER_KEY);
}
