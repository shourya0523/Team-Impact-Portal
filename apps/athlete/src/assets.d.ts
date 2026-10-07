// Metro resolves image imports to an asset reference that <Image source> accepts.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
