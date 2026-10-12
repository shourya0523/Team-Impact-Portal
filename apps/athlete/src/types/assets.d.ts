/** Metro resolves image imports to an asset id for <Image source> (also used by @team-impact/ui-primitives/native). */
declare module '*.png' {
  const asset: number;
  export default asset;
}
