module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-gesture-handler|react-native-reanimated|@shopify/react-native-skia|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-sound|react-native-mmkv|react-native-worklets)/)',
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg|mp3|wav|m4a|aac|ogg|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
