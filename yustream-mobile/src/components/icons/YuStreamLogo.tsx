import React from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';

interface YuStreamLogoProps {
  size?: number;
  showText?: boolean;
  style?: ViewStyle;
  variant?: 'default' | 'live' | 'offline';
}

const YuStreamLogo: React.FC<YuStreamLogoProps> = ({ 
  size = 64, 
  showText = true, 
  style,
  variant = 'default'
}) => {
  const getGradientColors = () => {
    switch (variant) {
      case 'live':
        return {
          primary: '#2ed573',
          secondary: '#1e90ff',
        };
      case 'offline':
        return {
          primary: '#ff6b6b',
          secondary: '#ee5a52',
        };
      default:
        return {
          primary: '#667eea',
          secondary: '#764ba2',
        };
    }
  };

  const colors = getGradientColors();
  const textSize = size * 0.3;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Background circle with gradient effect */}
      <View style={[
        styles.circle, 
        { 
          width: size, 
          height: size, 
          backgroundColor: colors.primary,
          borderRadius: size / 2,
        }
      ]}>
        {/* Inner circle for gradient effect */}
        <View style={[
          styles.innerCircle,
          {
            width: size * 0.9,
            height: size * 0.9,
            backgroundColor: colors.secondary,
            borderRadius: (size * 0.9) / 2,
          }
        ]} />
        
        {/* Play button */}
        <View style={[styles.playButton, { 
          borderLeftWidth: size * 0.25,
          borderTopWidth: size * 0.15,
          borderBottomWidth: size * 0.15,
          borderLeftColor: '#ffffff',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
        }]} />
        
        {/* Live indicator for live variant */}
        {variant === 'live' && (
          <View style={[
            styles.liveIndicator,
            {
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: (size * 0.25) / 2,
              top: size * 0.05,
              right: size * 0.05,
            }
          ]}>
            <Text style={[styles.liveText, { fontSize: size * 0.08 }]}>LIVE</Text>
          </View>
        )}
        
        {/* Offline indicator for offline variant */}
        {variant === 'offline' && (
          <View style={[
            styles.offlineIndicator,
            {
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: (size * 0.25) / 2,
              top: size * 0.05,
              right: size * 0.05,
            }
          ]}>
            <Text style={[styles.offlineText, { fontSize: size * 0.08 }]}>OFF</Text>
          </View>
        )}
      </View>
      
      {/* Text below logo */}
      {showText && (
        <Text style={[styles.text, { fontSize: textSize, marginTop: size * 0.1 }]}>
          YuStream
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  innerCircle: {
    position: 'absolute',
    opacity: 0.3,
  },
  playButton: {
    marginLeft: 2,
    zIndex: 1,
  },
  liveIndicator: {
    position: 'absolute',
    backgroundColor: '#ff4757',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  offlineIndicator: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  text: {
    color: '#667eea',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default YuStreamLogo;

