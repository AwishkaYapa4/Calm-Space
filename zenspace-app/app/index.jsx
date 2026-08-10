import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('zs_profile').then(val => {
      if (val) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#8b5cf6" />
    </View>
  );
}
