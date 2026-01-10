import { IDataSanitizer } from '../interfaces/ILangGraphServices';

/**
 * Service for sanitizing and formatting data for logging
 * Handles truncation of long strings and removal of sensitive information
 */
export class DataSanitizerService implements IDataSanitizer {
    private readonly inputMaxLength: number;
    private readonly outputMaxLength: number;
    private readonly toolInputMaxLength: number;

    constructor(
        inputMaxLength: number = 500,
        outputMaxLength: number = 1000,
        toolInputMaxLength: number = 200
    ) {
        this.inputMaxLength = inputMaxLength;
        this.outputMaxLength = outputMaxLength;
        this.toolInputMaxLength = toolInputMaxLength;
    }

    /**
     * Sanitize input for logging (remove sensitive data, truncate if needed)
     */
    sanitizeInput(input: string): string {
        if (input.length > this.inputMaxLength) {
            return input.substring(0, this.inputMaxLength) + '...';
        }
        return input;
    }

    /**
     * Sanitize output for logging
     */
    sanitizeOutput(output: string): string {
        if (output.length > this.outputMaxLength) {
            return output.substring(0, this.outputMaxLength) + '...';
        }
        return output;
    }

    /**
     * Sanitize tool input/output objects
     */
    sanitizeToolInput(input: any): any {
        if (input === null || input === undefined) {
            return input;
        }

        if (typeof input === 'string') {
            return this.sanitizeInput(input);
        }

        if (typeof input !== 'object') {
            return input;
        }

        const sanitized = { ...input };
        
        // Truncate string values
        Object.keys(sanitized).forEach(key => {
            if (typeof sanitized[key] === 'string' && sanitized[key].length > this.toolInputMaxLength) {
                sanitized[key] = sanitized[key].substring(0, this.toolInputMaxLength) + '...';
            }
        });
        
        return sanitized;
    }
}