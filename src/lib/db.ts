/**
 * Escapes Postgres ILIKE/LIKE special characters (%, _, and the backslash
 * escape character itself) so a value used with Prisma's `mode: "insensitive"`
 * — which Prisma compiles to ILIKE under the hood for both `equals` and
 * `contains` — is matched literally instead of as a pattern.
 *
 * Without this, a stored value (an email, a name) ending in an odd number of
 * backslashes throws a hard Postgres error ("LIKE pattern must not end with
 * escape character") instead of just not matching — confirmed in production
 * via a contact whose email tripped this on a case-insensitive lookup.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
