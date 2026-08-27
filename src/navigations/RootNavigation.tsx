import {
    createStaticNavigation,
} from '@react-navigation/native';
import {
    createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { PlayScreen, StartScreen } from '../screens';


const RootStack = createNativeStackNavigator({
    initialRouteName: 'Start',
    screens: {
        Start: {
            screen: StartScreen,
            options: { headerShown: false }
        },
        Play: {
            screen: PlayScreen,
            options: { headerShown: false }
        },
    }
})
type RootStackType = typeof RootStack;

declare module '@react-navigation/native' {
    interface RootNavigator extends RootStackType { }
}

export const Navigation = createStaticNavigation(RootStack)
