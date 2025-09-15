import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Icon, YuStreamLogo } from './icons';

const IconShowcase: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>YuStream Icons</Text>
      
      {/* Logo variants */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logo Variants</Text>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <YuStreamLogo size={80} variant="default" />
            <Text style={styles.iconLabel}>Default</Text>
          </View>
          <View style={styles.iconContainer}>
            <YuStreamLogo size={80} variant="live" />
            <Text style={styles.iconLabel}>Live</Text>
          </View>
          <View style={styles.iconContainer}>
            <YuStreamLogo size={80} variant="offline" />
            <Text style={styles.iconLabel}>Offline</Text>
          </View>
        </View>
      </View>

      {/* Control icons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Control Icons</Text>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Icon name="play" size={40} color="#2ed573" />
            <Text style={styles.iconLabel}>Play</Text>
          </View>
          <View style={styles.iconContainer}>
            <Icon name="pause" size={40} color="#ffa502" />
            <Text style={styles.iconLabel}>Pause</Text>
          </View>
          <View style={styles.iconContainer}>
            <Icon name="stop" size={40} color="#ff4757" />
            <Text style={styles.iconLabel}>Stop</Text>
          </View>
        </View>
      </View>

      {/* Status icons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Icons</Text>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Icon name="live" size={50} />
            <Text style={styles.iconLabel}>Live</Text>
          </View>
          <View style={styles.iconContainer}>
            <Icon name="offline" size={50} />
            <Text style={styles.iconLabel}>Offline</Text>
          </View>
        </View>
      </View>

      {/* Utility icons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Utility Icons</Text>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Icon name="settings" size={40} color="#667eea" />
            <Text style={styles.iconLabel}>Settings</Text>
          </View>
          <View style={styles.iconContainer}>
            <Icon name="refresh" size={40} color="#2ed573" />
            <Text style={styles.iconLabel}>Refresh</Text>
          </View>
        </View>
      </View>

      {/* Different sizes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Different Sizes</Text>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <YuStreamLogo size={40} showText={false} />
            <Text style={styles.iconLabel}>Small</Text>
          </View>
          <View style={styles.iconContainer}>
            <YuStreamLogo size={80} showText={false} />
            <Text style={styles.iconLabel}>Medium</Text>
          </View>
          <View style={styles.iconContainer}>
            <YuStreamLogo size={120} showText={false} />
            <Text style={styles.iconLabel}>Large</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    minWidth: 80,
  },
  iconLabel: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default IconShowcase;

