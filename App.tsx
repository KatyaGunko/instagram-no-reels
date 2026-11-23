import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InstagramWebView } from './src/InstagramWebView';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <InstagramWebView />
    </SafeAreaProvider>
  );
}
