import {
    createStaticNavigation,
} from '@react-navigation/native';
import {
    createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { PlayScreen, StartScreen, LevelScreen } from '../screens';


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
        Levels: {
            screen: LevelScreen,
            options: { headerShown: false, animation: 'fade' }
        },
    }
})
type RootStackType = typeof RootStack;

declare module '@react-navigation/native' {
    interface RootNavigator extends RootStackType { }
}

export const Navigation = createStaticNavigation(RootStack)
