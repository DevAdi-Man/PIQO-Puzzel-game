/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, useColorScheme, } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Navigation } from './src/navigations';
import { PlayScreen } from './src/screens';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle={!isDarkMode ? 'light-content' : 'dark-content'} />
        <Navigation />
      </SafeAreaProvider >
    </GestureHandlerRootView>
  );
}



export default App;
