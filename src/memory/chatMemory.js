/**
 * F1 Chat Memory Implementation
 * SQLite-based conversation persistence for F1 LangGraph agents
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

export class F1ChatMemory {
  constructor(options = {}) {
    this.dbPath = options.dbPath || './database/f1_chat_history.sqlite';
    this.db = null;
    this.logger = logger;
    this.maxConversationAge = options.maxConversationAge || 30; // days
    this.maxMessagesPerConversation = options.maxMessagesPerConversation || 100;
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Create tables
      await this.createTables();
      
      // Clean up old conversations
      await this.cleanupOldConversations();

      this.logger.info('F1ChatMemory: Database initialized successfully', {
        dbPath: this.dbPath
      });

    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to initialize database', {
        error: error.message,
        dbPath: this.dbPath
      });
      throw error;
    }
  }

  /**
   * Create database schema
   */
  async createTables() {
    const schema = `
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT UNIQUE NOT NULL,
        user_context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        last_agent TEXT,
        session_metadata TEXT
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL, -- 'user', 'assistant', 'system'
        content TEXT NOT NULL,
        agent_type TEXT, -- 'season', 'driver', 'race', etc.
        confidence REAL,
        f1_data TEXT, -- JSON string of F1 data used
        query_type TEXT,
        processing_time INTEGER,
        api_calls INTEGER,
        node_sequence TEXT, -- JSON array of processing nodes
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES conversations (thread_id)
      );

      -- Query analytics table
      CREATE TABLE IF NOT EXISTS query_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        query TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        confidence REAL,
        processing_time INTEGER,
        success BOOLEAN,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES conversations (thread_id)
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_thread_id ON query_analytics(thread_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_agent_type ON query_analytics(agent_type);
    `;

    await this.db.exec(schema);
  }

  /**
   * Save a conversation message with metadata
   */
  async saveMessage(threadId, role, content, metadata = {}) {
    try {
      // Ensure conversation exists
      await this.ensureConversation(threadId, metadata.userContext);

      // Extract metadata
      const {
        agentType,
        confidence,
        f1Data,
        queryType,
        processingTime,
        apiCalls,
        nodeSequence
      } = metadata;

      // Insert message
      await this.db.run(`
        INSERT INTO messages (
          thread_id, role, content, agent_type, confidence, 
          f1_data, query_type, processing_time, api_calls, node_sequence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        threadId,
        role,
        content,
        agentType || null,
        confidence || null,
        f1Data ? JSON.stringify(f1Data) : null,
        queryType || null,
        processingTime || null,
        apiCalls || null,
        nodeSequence ? JSON.stringify(nodeSequence) : null
      ]);

      // Update conversation metadata
      await this.updateConversation(threadId, agentType);

      // Save analytics if this is a query result
      if (role === 'assistant' && agentType) {
        await this.saveQueryAnalytics(threadId, content, metadata);
      }

      this.logger.debug('F1ChatMemory: Message saved', {
        threadId,
        role,
        agentType,
        contentLength: content.length
      });

    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to save message', {
        threadId,
        role,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get conversation history with optional filtering
   */
  async getConversationHistory(threadId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        includeMetadata = false,
        roleFilter = null
      } = options;

      let query = `
        SELECT * FROM messages 
        WHERE thread_id = ?
      `;
      const params = [threadId];

      if (roleFilter) {
        query += ` AND role = ?`;
        params.push(roleFilter);
      }

      query += ` ORDER BY created_at ASC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const messages = await this.db.all(query, params);

      // Parse JSON fields
      const processedMessages = messages.map(msg => ({
        ...msg,
        f1_data: msg.f1_data ? JSON.parse(msg.f1_data) : null,
        node_sequence: msg.node_sequence ? JSON.parse(msg.node_sequence) : null,
        metadata: includeMetadata ? {
          agent_type: msg.agent_type,
          confidence: msg.confidence,
          query_type: msg.query_type,
          processing_time: msg.processing_time,
          api_calls: msg.api_calls
        } : undefined
      }));

      this.logger.debug('F1ChatMemory: Retrieved conversation history', {
        threadId,
        messageCount: processedMessages.length
      });

      return processedMessages;

    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to get conversation history', {
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get conversation summary and statistics
   */
  async getConversationSummary(threadId) {
    try {
      const conversation = await this.db.get(`
        SELECT * FROM conversations WHERE thread_id = ?
      `, [threadId]);

      if (!conversation) {
        return null;
      }

      const messageStats = await this.db.get(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages,
          AVG(confidence) as avg_confidence,
          AVG(processing_time) as avg_processing_time,
          SUM(api_calls) as total_api_calls
        FROM messages 
        WHERE thread_id = ?
      `, [threadId]);

      const agentUsage = await this.db.all(`
        SELECT 
          agent_type,
          COUNT(*) as usage_count,
          AVG(confidence) as avg_confidence
        FROM messages 
        WHERE thread_id = ? AND agent_type IS NOT NULL
        GROUP BY agent_type
        ORDER BY usage_count DESC
      `, [threadId]);

      return {
        conversation: {
          ...conversation,
          user_context: conversation.user_context ? JSON.parse(conversation.user_context) : null,
          session_metadata: conversation.session_metadata ? JSON.parse(conversation.session_metadata) : null
        },
        statistics: messageStats,
        agentUsage
      };

    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to get conversation summary', {
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Ensure conversation record exists
   */
  async ensureConversation(threadId, userContext = {}) {
    try {
      const existing = await this.db.get(
        'SELECT id FROM conversations WHERE thread_id = ?',
        [threadId]
      );

      if (!existing) {
        await this.db.run(`
          INSERT INTO conversations (thread_id, user_context, session_metadata)
          VALUES (?, ?, ?)
        `, [
          threadId,
          JSON.stringify(userContext),
          JSON.stringify({
            created_with: 'f1-langgraph-agents',
            version: '1.0.0'
          })
        ]);

        this.logger.debug('F1ChatMemory: New conversation created', {
          threadId
        });
      }
    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to ensure conversation', {
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update conversation metadata
   */
  async updateConversation(threadId, lastAgent = null) {
    try {
      await this.db.run(`
        UPDATE conversations 
        SET 
          updated_at = CURRENT_TIMESTAMP,
          message_count = (
            SELECT COUNT(*) FROM messages WHERE thread_id = ?
          ),
          last_agent = COALESCE(?, last_agent)
        WHERE thread_id = ?
      `, [threadId, lastAgent, threadId]);

    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to update conversation', {
        threadId,
        error: error.message
      });
    }
  }

  /**
   * Save query analytics
   */
  async saveQueryAnalytics(threadId, content, metadata) {
    try {
      const {
        query,
        agentType,
        confidence,
        processingTime,
        success = true,
        error
      } = metadata;

      await this.db.run(`
        INSERT INTO query_analytics (
          thread_id, query, agent_type, confidence, 
          processing_time, success, error_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        threadId,
        query || content.substring(0, 500),
        agentType,
        confidence,
        processingTime,
        success,
        error?.message || null
      ]);

    } catch (error) {
      this.logger.warn('F1ChatMemory: Failed to save query analytics', {
        threadId,
        error: error.message
      });
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalytics(options = {}) {
    try {
      const {
        days = 7,
        agentType = null
      } = options;

      let query = `
        SELECT 
          agent_type,
          COUNT(*) as query_count,
          AVG(confidence) as avg_confidence,
          AVG(processing_time) as avg_processing_time,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_queries,
          COUNT(*) - SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as failed_queries
        FROM query_analytics
        WHERE created_at >= datetime('now', '-${days} days')
      `;

      const params = [];

      if (agentType) {
        query += ` AND agent_type = ?`;
        params.push(agentType);
      }

      query += ` GROUP BY agent_type ORDER BY query_count DESC`;

      const analytics = await this.db.all(query, params);

      return {
        period: `${days} days`,
        agentPerformance: analytics,
        totalQueries: analytics.reduce((sum, a) => sum + a.query_count, 0),
        overallSuccessRate: analytics.length > 0 
          ? analytics.reduce((sum, a) => sum + a.successful_queries, 0) / 
            analytics.reduce((sum, a) => sum + a.query_count, 0)
          : 0
      };

    } catch (error) {
      this.logger.error('F1ChatMemory: Failed to get analytics', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxConversationAge);

      const result = await this.db.run(`
        DELETE FROM conversations 
        WHERE created_at < datetime(?)
      `, [cutoffDate.toISOString()]);

      if (result.changes > 0) {
        this.logger.info('F1ChatMemory: Cleaned up old conversations', {
          deletedCount: result.changes,
          cutoffDate: cutoffDate.toISOString()
        });
      }

    } catch (error) {
      this.logger.warn('F1ChatMemory: Failed to cleanup old conversations', {
        error: error.message
      });
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.logger.info('F1ChatMemory: Database connection closed');
    }
  }

  /**
   * Get database health information
   */
  async getHealth() {
    try {
      const conversationCount = await this.db.get(
        'SELECT COUNT(*) as count FROM conversations'
      );
      
      const messageCount = await this.db.get(
        'SELECT COUNT(*) as count FROM messages'
      );

      const recentActivity = await this.db.get(`
        SELECT COUNT(*) as count FROM messages 
        WHERE created_at >= datetime('now', '-24 hours')
      `);

      return {
        status: 'healthy',
        conversationCount: conversationCount.count,
        messageCount: messageCount.count,
        recentActivity: recentActivity.count,
        dbPath: this.dbPath
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        dbPath: this.dbPath
      };
    }
  }
}

export default F1ChatMemory;