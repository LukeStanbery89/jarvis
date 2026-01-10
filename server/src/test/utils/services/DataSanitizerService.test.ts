import { DataSanitizerService } from '../../../utils/services/DataSanitizerService';

describe('DataSanitizerService', () => {
    let service: DataSanitizerService;

    beforeEach(() => {
        service = new DataSanitizerService();
    });

    describe('sanitizeInput', () => {
        it('should return input unchanged when under length limit', () => {
            const input = 'Short input text';
            const result = service.sanitizeInput(input);
            
            expect(result).toBe(input);
        });

        it('should truncate input when over length limit', () => {
            const longInput = 'A'.repeat(600);
            const result = service.sanitizeInput(longInput);
            
            expect(result).toBe('A'.repeat(500) + '...');
            expect(result.length).toBe(503);
        });

        it('should handle empty string', () => {
            const result = service.sanitizeInput('');
            expect(result).toBe('');
        });

        it('should handle exact length limit', () => {
            const input = 'A'.repeat(500);
            const result = service.sanitizeInput(input);
            
            expect(result).toBe(input);
            expect(result.length).toBe(500);
        });
    });

    describe('sanitizeOutput', () => {
        it('should return output unchanged when under length limit', () => {
            const output = 'Short output text';
            const result = service.sanitizeOutput(output);
            
            expect(result).toBe(output);
        });

        it('should truncate output when over length limit', () => {
            const longOutput = 'B'.repeat(1200);
            const result = service.sanitizeOutput(longOutput);
            
            expect(result).toBe('B'.repeat(1000) + '...');
            expect(result.length).toBe(1003);
        });

        it('should handle empty string', () => {
            const result = service.sanitizeOutput('');
            expect(result).toBe('');
        });

        it('should handle exact length limit', () => {
            const output = 'B'.repeat(1000);
            const result = service.sanitizeOutput(output);
            
            expect(result).toBe(output);
            expect(result.length).toBe(1000);
        });
    });

    describe('sanitizeToolInput', () => {
        it('should return null/undefined unchanged', () => {
            expect(service.sanitizeToolInput(null)).toBeNull();
            expect(service.sanitizeToolInput(undefined)).toBeUndefined();
        });

        it('should handle primitive types', () => {
            expect(service.sanitizeToolInput('test')).toBe('test');
            expect(service.sanitizeToolInput(123)).toBe(123);
            expect(service.sanitizeToolInput(true)).toBe(true);
        });

        it('should truncate long string values in objects', () => {
            const input = {
                shortString: 'short',
                longString: 'C'.repeat(300),
                number: 42,
                boolean: true
            };

            const result = service.sanitizeToolInput(input);

            expect(result.shortString).toBe('short');
            expect(result.longString).toBe('C'.repeat(200) + '...');
            expect(result.number).toBe(42);
            expect(result.boolean).toBe(true);
        });

        it('should handle empty objects', () => {
            const result = service.sanitizeToolInput({});
            expect(result).toEqual({});
        });

        it('should not modify original object', () => {
            const original = {
                longString: 'D'.repeat(300)
            };
            const originalCopy = { ...original };

            service.sanitizeToolInput(original);

            expect(original).toEqual(originalCopy);
        });

        it('should handle objects with null/undefined values', () => {
            const input = {
                nullValue: null,
                undefinedValue: undefined,
                stringValue: 'test'
            };

            const result = service.sanitizeToolInput(input);

            expect(result.nullValue).toBeNull();
            expect(result.undefinedValue).toBeUndefined();
            expect(result.stringValue).toBe('test');
        });
    });

    describe('constructor with custom limits', () => {
        it('should use custom length limits', () => {
            const customService = new DataSanitizerService(10, 20, 5);

            expect(customService.sanitizeInput('A'.repeat(15))).toBe('A'.repeat(10) + '...');
            expect(customService.sanitizeOutput('B'.repeat(25))).toBe('B'.repeat(20) + '...');
            
            const toolInput = { longString: 'C'.repeat(10) };
            const result = customService.sanitizeToolInput(toolInput);
            expect(result.longString).toBe('C'.repeat(5) + '...');
        });
    });
});