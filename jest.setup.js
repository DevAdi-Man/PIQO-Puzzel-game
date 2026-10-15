/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

// Mock react-native-worklets
jest.mock('react-native-worklets', () => {
  const target = {
    RuntimeKind: { ReactNative: 0, UI: 1 },
    createShareable: jest.fn((_id, val) => ({
      getSync: () => val,
      setSync: jest.fn(),
      getAsync: () => Promise.resolve(val),
      setAsync: jest.fn(),
    })),
    createSerializable: jest.fn((v) => v),
    makeShareable: jest.fn((v) => v),
    isShareable: jest.fn(() => true),
    isWorkletFunction: jest.fn(() => false),
    scheduleOnRN: jest.fn((fn, ...args) => (fn ? fn(...args) : undefined)),
    scheduleOnUI: jest.fn((fn, ...args) => (fn ? fn(...args) : undefined)),
    runOnJS: (fn) => (...args) => (fn ? fn(...args) : undefined),
    runOnUI: (fn) => (...args) => (fn ? fn(...args) : undefined),
    runOnUISync: (fn) => (fn ? fn() : undefined),
    WorkletsModule: {},
    serializableMappingCache: new Map(),
    shareableMappingCache: new Map(),
  };
  return new Proxy(target, {
    get: (obj, prop) => {
      if (prop === '__esModule') return true;
      if (prop in obj) return obj[prop];
      return jest.fn((...args) => args[0]);
    },
  });
});

// Mock react-native-reanimated completely to avoid Reanimated 4.6.0 setCSSEventHandler issue
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const ReactNative = require('react-native');

  const createAnimatedComponent = (Component) => Component;

  const AnimatedView = React.forwardRef((props, ref) =>
    React.createElement(ReactNative.View, { ...props, ref })
  );
  AnimatedView.displayName = 'Animated.View';

  const AnimatedText = React.forwardRef((props, ref) =>
    React.createElement(ReactNative.Text, { ...props, ref })
  );
  AnimatedText.displayName = 'Animated.Text';

  const transitionBuilder = () => {
    const chain = {
      duration: () => chain,
      delay: () => chain,
      springify: () => chain,
      damping: () => chain,
      stiffness: () => chain,
      mass: () => chain,
      overshootClamping: () => chain,
      restDisplacementThreshold: () => chain,
      restSpeedThreshold: () => chain,
    };
    return chain;
  };

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      Text: AnimatedText,
      ScrollView: ReactNative.ScrollView,
      createAnimatedComponent,
    },
    View: AnimatedView,
    Text: AnimatedText,
    ScrollView: ReactNative.ScrollView,
    createAnimatedComponent,
    makeMutable: (val) => ({ value: val }),
    useSharedValue: (val) => ({ value: val }),
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedStyle: (fn) => fn(),
    useAnimatedReaction: jest.fn(),
    withTiming: (toValue) => toValue,
    withSpring: (toValue) => toValue,
    withDelay: (_delay, animation) => animation,
    withRepeat: (animation) => animation,
    withSequence: (...animations) => animations[0],
    cancelAnimation: jest.fn(),
    interpolateColor: jest.fn(() => '#ffffff'),
    FadeIn: transitionBuilder(),
    FadeInDown: transitionBuilder(),
    FadeInUp: transitionBuilder(),
    FadeOut: transitionBuilder(),
    ZoomIn: transitionBuilder(),
    ZoomInUp: transitionBuilder(),
    ZoomOut: transitionBuilder(),
    SlideInRight: transitionBuilder(),
    SlideInLeft: transitionBuilder(),
    LinearTransition: transitionBuilder(),
    Layout: transitionBuilder(),
  };
});

// Mock react-native-sound
jest.mock('react-native-sound', () => {
  // Like the native module, report "loaded" asynchronously after construction.
  const SoundMock = jest.fn().mockImplementation((_uri, _basePath, onLoad) => {
    Promise.resolve().then(() => onLoad && onLoad(null));
    return {
      setVolume: jest.fn(),
      setCurrentTime: jest.fn(),
      play: jest.fn((cb) => cb && cb(true)),
      stop: jest.fn((cb) => cb && cb()),
      release: jest.fn(),
    };
  });
  SoundMock.setCategory = jest.fn();
  return SoundMock;
});

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const map = new Map();
  return {
    createMMKV: jest.fn(() => ({
      set: jest.fn((k, v) => map.set(k, String(v))),
      getString: jest.fn((k) => map.get(k) ?? null),
      getNumber: jest.fn((k) => Number(map.get(k))),
      getBoolean: jest.fn((k) => Boolean(map.get(k))),
      remove: jest.fn((k) => map.delete(k)),
      clearAll: jest.fn(() => map.clear()),
    })),
  };
});

// Mock Shopify Skia
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const View = require('react-native').View;
  const MockComponent = ({ children, ...props }) => React.createElement(View, props, children);

  const mockPath = {
    addRect: jest.fn(),
    addRRect: jest.fn(),
    simplify: jest.fn(),
    addPath: jest.fn(),
    op: jest.fn(),
    transform: jest.fn(),
  };

  return {
    Canvas: MockComponent,
    Group: MockComponent,
    Path: MockComponent,
    RoundedRect: MockComponent,
    Rect: MockComponent,
    LinearGradient: MockComponent,
    Mask: MockComponent,
    CornerPathEffect: MockComponent,
    Image: MockComponent,
    ImageShader: MockComponent,
    useImage: jest.fn(() => ({ width: 100, height: 100 })),
    vec: jest.fn((x, y) => ({ x, y })),
    PathOp: { Union: 0 },
    Skia: {
      Path: {
        Make: jest.fn(() => ({ ...mockPath })),
        MakeFromSVGString: jest.fn(() => ({ ...mockPath })),
      },
      Matrix: jest.fn(() => ({
        translate: jest.fn(),
        scale: jest.fn(),
      })),
      XYWHRect: jest.fn((x, y, w, h) => ({ x, y, width: w, height: h })),
      RRectXY: jest.fn((rect, rx, ry) => ({ rect, rx, ry })),
    },
  };
});
