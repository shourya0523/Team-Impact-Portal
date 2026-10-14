/** Bundlers (Vite) resolve image imports to a URL. */
declare module '*.png' {
  const url: string;
  export default url;
}
