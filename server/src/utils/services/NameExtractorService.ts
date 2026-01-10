import { Serialized } from '@langchain/core/load/serializable';
import { INameExtractor } from '../interfaces/ILangGraphServices';

/**
 * Service for extracting names from LangChain Serialized objects
 * Handles various serialization formats and fallback strategies
 */
export class NameExtractorService implements INameExtractor {
    /**
     * Extract name from LangChain Serialized object using generic approach
     */
    extractName(serialized: Serialized): string {
        // First try the direct name property
        if (serialized.name) {
            return serialized.name;
        }
        
        // For constructor objects, extract the class name from the id array
        if ('id' in serialized && Array.isArray(serialized.id) && serialized.id.length > 0) {
            // The last element in the id array is typically the class name
            const className = serialized.id[serialized.id.length - 1];
            if (className && typeof className === 'string') {
                return className;
            }
        }
        
        // Check kwargs for name information
        if ('kwargs' in serialized && serialized.kwargs && typeof serialized.kwargs === 'object') {
            const kwargs = serialized.kwargs as any;
            if (kwargs.name) {
                return kwargs.name;
            }
            // For LLMs, check for model name
            if (kwargs.model_name || kwargs.modelName || kwargs.model) {
                return kwargs.model_name || kwargs.modelName || kwargs.model;
            }
        }
        
        // Fallback to the serialized type if available
        if ('lc' in serialized && 'type' in serialized) {
            return `${serialized.type || 'unknown'}`;
        }
        
        return 'unknown';
    }

    /**
     * Extract tool name from LangChain Serialized object
     */
    extractToolName(tool: Serialized): string {
        return this.extractName(tool);
    }

    /**
     * Extract LLM name from LangChain Serialized object
     */
    extractLLMName(llm: Serialized): string {
        return this.extractName(llm);
    }
}