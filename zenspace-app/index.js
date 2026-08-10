import { AppRegistry } from 'react-native';
import runBackgroundCaptureTask from './src/lib/behavior/headlessCaptureTask';

// Registered before the router entry so it's available the instant Android
// starts BehaviorHeadlessTaskService.kt, even if that happens before any
// screen has mounted (e.g. the app was fully killed).
AppRegistry.registerHeadlessTask('BehaviorCaptureTask', () => runBackgroundCaptureTask);

import 'expo-router/entry';
