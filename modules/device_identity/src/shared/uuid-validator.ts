/**
 * UUID Validator
 * Provides consistent UUID validation across all platforms
 *
 * Uses permissive UUID format to support both:
 * - Browser-generated UUIDs (crypto.randomUUID, strict v4 format)
 * - Hardware-generated UUIDs (deterministic SHA-256 hash-based)
 */
export class UUIDValidator {
    /**
     * Standard UUID format regex (permissive)
     * Accepts any valid UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
     * Does NOT enforce version or variant bits to support deterministic UUIDs
     */
    private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Validates if a string is a valid UUID format
     *
     * @param uuid - The UUID string to validate
     * @returns True if the string matches UUID format, false otherwise
     *
     * @example
     * UUIDValidator.validate('550e8400-e29b-41d4-a716-446655440000'); // true
     * UUIDValidator.validate('not-a-uuid'); // false
     */
    static validate(uuid: string): boolean {
        return this.UUID_REGEX.test(uuid);
    }
}
