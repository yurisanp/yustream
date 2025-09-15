import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface IconProps {
  name: 'logo' | 'play' | 'pause' | 'stop' | 'live' | 'offline' | 'settings' | 'refresh';
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#667eea', style }) => {
  const getIconPath = () => {
    switch (name) {
      case 'logo':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.circle, { backgroundColor: color }]}>
              <View style={[styles.playButton, { 
                borderLeftWidth: size * 0.3,
                borderTopWidth: size * 0.2,
                borderBottomWidth: size * 0.2,
                borderLeftColor: '#ffffff',
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
              }]} />
            </View>
          </View>
        );
      case 'play':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.playButton, { 
              borderLeftWidth: size * 0.4,
              borderTopWidth: size * 0.25,
              borderBottomWidth: size * 0.25,
              borderLeftColor: color,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
            }]} />
          </View>
        );
      case 'pause':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.pauseContainer, { width: size, height: size }]}>
              <View style={[styles.pauseBar, { backgroundColor: color, width: size * 0.15, height: size * 0.6 }]} />
              <View style={[styles.pauseBar, { backgroundColor: color, width: size * 0.15, height: size * 0.6 }]} />
            </View>
          </View>
        );
      case 'stop':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.stopButton, { backgroundColor: color, width: size * 0.6, height: size * 0.6 }]} />
          </View>
        );
      case 'live':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.liveIndicator, { backgroundColor: '#ff4757', width: size, height: size }]}>
              <View style={styles.liveTextContainer}>
                <View style={[styles.liveText, { fontSize: size * 0.3 }]}>LIVE</View>
              </View>
            </View>
          </View>
        );
      case 'offline':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.offlineIndicator, { backgroundColor: '#ff6b6b', width: size, height: size }]}>
              <View style={styles.offlineTextContainer}>
                <View style={[styles.offlineText, { fontSize: size * 0.25 }]}>OFF</View>
              </View>
            </View>
          </View>
        );
      case 'settings':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.settingsContainer, { width: size, height: size }]}>
              <View style={[styles.settingsGear, { 
                width: size * 0.8, 
                height: size * 0.8, 
                borderWidth: size * 0.1,
                borderColor: color,
                borderRadius: size * 0.4
              }]} />
              <View style={[styles.settingsCenter, { 
                width: size * 0.3, 
                height: size * 0.3, 
                backgroundColor: color,
                borderRadius: size * 0.15
              }]} />
            </View>
          </View>
        );
      case 'refresh':
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <View style={[styles.refreshContainer, { width: size, height: size }]}>
              <View style={[styles.refreshArrow, { 
                width: size * 0.4, 
                height: size * 0.4, 
                borderWidth: size * 0.08,
                borderColor: color,
                borderTopColor: 'transparent',
                borderRightColor: 'transparent',
                borderRadius: size * 0.2
              }]} />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return getIconPath();
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  playButton: {
    marginLeft: 2,
  },
  pauseContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pauseBar: {
    borderRadius: 2,
  },
  stopButton: {
    borderRadius: 4,
  },
  liveIndicator: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  offlineIndicator: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  settingsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsGear: {
    position: 'absolute',
  },
  settingsCenter: {
    position: 'absolute',
  },
  refreshContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshArrow: {
    transform: [{ rotate: '45deg' }],
  },
});

export default Icon;

