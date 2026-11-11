/** "Grace Mensah" → "Grace-Mensah-CV.pdf". ASCII-safe for Content-Disposition. */
export function pdfFilename(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'My'}-CV.pdf`;
}
