module.exports = {
  dependencies: {
    // Exclude react-native-reanimated from autolinking due to CMake codegen issues
    // The library is installed but not linked natively
    'react-native-reanimated': {
      platforms: {
        android: null,
        ios: null,
      },
    },
    // Also exclude react-native-worklets since it depends on reanimated
    'react-native-worklets': {
      platforms: {
        android: null,
        ios: null,
      },
    },
    // Exclude draggable-flatlist since it requires reanimated
    'react-native-draggable-flatlist': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
