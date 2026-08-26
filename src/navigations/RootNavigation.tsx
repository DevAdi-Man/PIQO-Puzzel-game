import {
    createStaticNavigation,
} from '@react-navigation/native';
import {
    createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { PlayScreen } from '../screens';


const RootStack = createNativeStackNavigator({
    screens: {
        Play: {
            screen: PlayScreen,
            options: {
                headerShown: false
            }
        },
    }
})
type RootStackType = typeof RootStack;

declare module '@react-navigation/native' {
    interface RootNavigator extends RootStackType { }
}

export const Navigation = createStaticNavigation(RootStack)
