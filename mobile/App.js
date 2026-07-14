import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OrgSelectScreen from './src/screens/OrgSelectScreen';
import RegisterOrgScreen from './src/screens/RegisterOrgScreen';
import JoinOrgScreen from './src/screens/JoinOrgScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import CartCaptureScreen from './src/screens/CartCaptureScreen';
import GleaningCaptureScreen from './src/screens/GleaningCaptureScreen';
import ConfirmScreen from './src/screens/ConfirmScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="OrgSelect"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="OrgSelect" component={OrgSelectScreen} />
          <Stack.Screen name="RegisterOrg" component={RegisterOrgScreen} />
          <Stack.Screen name="JoinOrg" component={JoinOrgScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Capture" component={CaptureScreen} />
          <Stack.Screen name="CartCapture" component={CartCaptureScreen} />
          <Stack.Screen name="GleaningCapture" component={GleaningCaptureScreen} />
          <Stack.Screen name="Confirm" component={ConfirmScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
