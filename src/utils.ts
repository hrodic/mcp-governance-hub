import path from "path";

/**
 * Generates a URL-friendly slug from a title string.
 *
 * @example
 * generateSlug("My ADR Title")     // "my-adr-title"
 * generateSlug("Special @# Chars!") // "special-chars"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves `relativePath` against `root` and throws if the result would
 * escape the root directory (path traversal attack).
 *
 * Uses `path.resolve` rather than regex stripping so it is immune to
 * normalisation bypasses and works identically on Windows and Linux.
 *
 * @throws {Error} if the resolved path is outside `root`.
 * @returns The safe, absolute resolved path.
 */
export function resolveSafePath(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);

  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error(
      `Path traversal blocked: "${relativePath}" resolves outside of the projects root.`,
    );
  }

  return resolved;
}
