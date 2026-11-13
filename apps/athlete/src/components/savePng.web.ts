/** Web: download the PNG straight from a data URL. Metro picks this file over `savePng.ts` on web. */
export const savePng = async (base64: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64}`;
  link.download = fileName;
  link.click();
};
