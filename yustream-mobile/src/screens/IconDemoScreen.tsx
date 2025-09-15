import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import IconShowcase from '../components/IconShowcase';

const IconDemoScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <IconShowcase />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});

export default IconDemoScreen;

