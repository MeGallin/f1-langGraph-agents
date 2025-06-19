/**
 * F1 GraphState Implementation
 * Immutable state management for LangGraph workflow
 */

export class F1GraphState {
  constructor(initialState = {}) {
    this.state = {
      // Core workflow state
      query: '',
      threadId: '',
      userContext: {},
      
      // Agent routing
      selectedAgent: null,
      agentResponse: null,
      confidence: 0,
      
      // F1 specific data
      f1Data: null,
      conversationHistory: [],
      
      // Processing metadata
      error: null,
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        apiCalls: 0,
        nodeSequence: []
      },
      
      // Override with initial state
      ...initialState
    };
  }

  /**
   * Immutable state updates
   * Returns new GraphState instance with updated values
   */
  updateState(updates) {
    const newState = new F1GraphState({
      ...this.state,
      ...updates,
      metadata: {
        ...this.state.metadata,
        ...updates.metadata
      }
    });
    
    return newState;
  }

  /**
   * Add node to processing sequence
   */
  addNodeToSequence(nodeName) {
    return this.updateState({
      metadata: {
        ...this.state.metadata,
        nodeSequence: [...this.state.metadata.nodeSequence, nodeName]
      }
    });
  }

  /**
   * Update processing time
   */
  updateProcessingTime(startTime) {
    const processingTime = Date.now() - startTime;
    return this.updateState({
      metadata: {
        ...this.state.metadata,
        processingTime
      }
    });
  }

  /**
   * Increment API call counter
   */
  incrementApiCalls(count = 1) {
    return this.updateState({
      metadata: {
        ...this.state.metadata,
        apiCalls: this.state.metadata.apiCalls + count
      }
    });
  }

  /**
   * Set error state
   */
  setError(error) {
    return this.updateState({
      error: {
        message: error.message || error,
        timestamp: new Date(),
        stack: error.stack
      }
    });
  }

  /**
   * Clear error state
   */
  clearError() {
    return this.updateState({
      error: null
    });
  }

  /**
   * Get current state (read-only)
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if state has error
   */
  hasError() {
    return this.state.error !== null;
  }

  /**
   * Get processing summary
   */
  getSummary() {
    return {
      query: this.state.query,
      threadId: this.state.threadId,
      selectedAgent: this.state.selectedAgent,
      confidence: this.state.confidence,
      hasError: this.hasError(),
      nodeSequence: this.state.metadata.nodeSequence,
      processingTime: this.state.metadata.processingTime,
      apiCalls: this.state.metadata.apiCalls
    };
  }

  /**
   * Validate state integrity
   */
  validate() {
    const issues = [];
    
    if (!this.state.query) {
      issues.push('Query is required');
    }
    
    if (!this.state.threadId) {
      issues.push('ThreadId is required');
    }
    
    if (this.state.confidence < 0 || this.state.confidence > 1) {
      issues.push('Confidence must be between 0 and 1');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

export default F1GraphState;