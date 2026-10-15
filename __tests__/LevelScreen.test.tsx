import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { LevelScreen } from '../src/screens/LevelScreen';
import { useLevelStore } from '../src/store/useLevelStore';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const flatten = (node: unknown): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(flatten).join('');
  if (typeof node === 'object') return flatten((node as { props?: { children?: unknown } }).props?.children);
  return String(node);
};

const textOf = (root: ReactTestRenderer.ReactTestInstance) =>
  root.findAllByType(Text).map((t) => flatten(t.props.children));

test('opens on the chapter that holds the current level', async () => {
  useLevelStore.setState({ maxUnlockedLevel: 17, currentLevelId: 17, levelStars: { 1: 3, 2: 2, 16: 1 } });

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<LevelScreen />);
  });

  // Total stars in the header.
  expect(textOf(renderer.root)).toContain('★ 6/225');

  const pager = renderer.root.findAll((n) => typeof n.props.onLayout === 'function')[0];
  await ReactTestRenderer.act(async () => {
    pager.props.onLayout({ nativeEvent: { layout: { width: 390, height: 600 } } });
  });

  const texts = textOf(renderer.root);
  expect(texts).toContain('Getting Tricky');
  expect(texts).toContain('CHAPTER 2 · 6×6');
  expect(texts).toContain('★ 1/45'); // chapter 2 stars
  expect(texts).toContain('PLAY'); // level 17 is the current level
});
