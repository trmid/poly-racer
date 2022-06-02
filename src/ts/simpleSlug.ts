export function slug(str: string) {
  return str
    .toLowerCase()
    .replace(/[\s\_]+/g, "-")
    .replace(/[^0-9a-z\-]/g, "");
}