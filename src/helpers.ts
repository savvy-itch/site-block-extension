export function stripUrl(url: string): string {
  return url.replace(/^\^https\?:\/\//, '').replace(/\.\*|\$$/, '');
}