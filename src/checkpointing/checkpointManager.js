/**
 * Modern Checkpoint Manager for F1 LangGraph Application
 * Implements LangGraph.js v0.2 checkpointing patterns with multiple storage backends
 */

import { BaseCheckpointSaver } from '@langchain/langgraph';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * SQLite Checkpoint Saver for production use
 */
export class SQLiteCheckpointSaver extends BaseCheckpointSaver {
  constructor(dbPath = './database/checkpoints.sqlite') {
    super();
    this.dbPath = dbPath;
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });

      // Open database
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Create tables
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          thread_id TEXT NOT NULL,
          checkpoint_ns TEXT NOT NULL DEFAULT '',
          checkpoint_id TEXT NOT NULL,
          parent_checkpoint_id TEXT,
          type TEXT,
          checkpoint BLOB NOT NULL,
          metadata BLOB NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id ON checkpoints(thread_id);
        CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at ON checkpoints(created_at);
      `);

      this.initialized = true;
      logger.info('SQLite checkpoint saver initialized', { dbPath: this.dbPath });
    } catch (error) {
      logger.error('Failed to initialize SQLite checkpoint saver', {
        error: error.message,
        dbPath: this.dbPath
      });
      throw error;
    }
  }

  async put(config, checkpoint, metadata, newVersions) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || '';
      const checkpointId = checkpoint.id || uuidv4();
      const parentCheckpointId = config.configurable.parent_checkpoint_id || null;
      const createdAt = Date.now();

      await this.db.run(
        `INSERT OR REPLACE INTO checkpoints 
         (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          threadId,
          checkpointNs,
          checkpointId,
          parentCheckpointId,
          'langgraph_checkpoint',
          JSON.stringify(checkpoint),
          JSON.stringify(metadata),
          createdAt
        ]
      );

      logger.debug('Checkpoint saved', {
        threadId,
        checkpointId,
        checkpointNs
      });

      return { 
        configurable: { 
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpointId
        }
      };
    } catch (error) {
      logger.error('Failed to save checkpoint', {
        error: error.message,
        threadId: config.configurable.thread_id
      });
      throw error;
    }
  }

  async get(config) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || '';
      const checkpointId = config.configurable.checkpoint_id;

      let query, params;

      if (checkpointId) {
        query = `
          SELECT checkpoint, metadata, created_at 
          FROM checkpoints 
          WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
        `;
        params = [threadId, checkpointNs, checkpointId];
      } else {
        query = `
          SELECT checkpoint, metadata, created_at 
          FROM checkpoints 
          WHERE thread_id = ? AND checkpoint_ns = ? 
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        params = [threadId, checkpointNs];
      }

      const row = await this.db.get(query, params);

      if (!row) {
        return null;
      }

      const checkpoint = JSON.parse(row.checkpoint);
      const metadata = JSON.parse(row.metadata);

      logger.debug('Checkpoint retrieved', {
        threadId,
        checkpointId: checkpoint.id,
        createdAt: row.created_at
      });

      return {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: checkpoint.id
          }
        },
        checkpoint,
        metadata
      };
    } catch (error) {
      logger.error('Failed to retrieve checkpoint', {
        error: error.message,
        threadId: config.configurable.thread_id
      });
      throw error;
    }
  }

  async list(config, limit, before) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || '';

      let query = `
        SELECT checkpoint_id, checkpoint, metadata, created_at 
        FROM checkpoints 
        WHERE thread_id = ? AND checkpoint_ns = ?
      `;
      const params = [threadId, checkpointNs];

      if (before) {
        query += ' AND created_at < ?';
        params.push(before);
      }

      query += ' ORDER BY created_at DESC';

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      const rows = await this.db.all(query, params);

      return rows.map(row => ({
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: row.checkpoint_id
          }
        },
        checkpoint: JSON.parse(row.checkpoint),
        metadata: JSON.parse(row.metadata)
      }));
    } catch (error) {
      logger.error('Failed to list checkpoints', {
        error: error.message,
        threadId: config.configurable.thread_id
      });
      throw error;
    }
  }

  async delete(config) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || '';
      const checkpointId = config.configurable.checkpoint_id;

      if (checkpointId) {
        await this.db.run(
          'DELETE FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?',
          [threadId, checkpointNs, checkpointId]
        );
      } else {
        await this.db.run(
          'DELETE FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ?',
          [threadId, checkpointNs]
        );
      }

      logger.debug('Checkpoint(s) deleted', {
        threadId,
        checkpointNs,
        checkpointId
      });
    } catch (error) {
      logger.error('Failed to delete checkpoint', {
        error: error.message,
        threadId: config.configurable.thread_id
      });
      throw error;
    }
  }

  async cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    if (!this.initialized) {
      return;
    }

    try {
      const cutoffTime = Date.now() - maxAge;
      
      const result = await this.db.run(
        'DELETE FROM checkpoints WHERE created_at < ?',
        [cutoffTime]
      );

      logger.info('Checkpoint cleanup completed', {
        deletedCount: result.changes,
        cutoffTime: new Date(cutoffTime).toISOString()
      });

      return result.changes;
    } catch (error) {
      logger.error('Failed to cleanup checkpoints', { error: error.message });
      throw error;
    }
  }

  async getStats() {
    if (!this.initialized) {
      return null;
    }

    try {
      const totalCheckpoints = await this.db.get('SELECT COUNT(*) as count FROM checkpoints');
      const threadCount = await this.db.get('SELECT COUNT(DISTINCT thread_id) as count FROM checkpoints');
      const oldestCheckpoint = await this.db.get('SELECT MIN(created_at) as oldest FROM checkpoints');
      const newestCheckpoint = await this.db.get('SELECT MAX(created_at) as newest FROM checkpoints');

      return {
        totalCheckpoints: totalCheckpoints.count,
        uniqueThreads: threadCount.count,
        oldestCheckpoint: oldestCheckpoint.oldest,
        newestCheckpoint: newestCheckpoint.newest,
        dbPath: this.dbPath
      };
    } catch (error) {
      logger.error('Failed to get checkpoint stats', { error: error.message });
      return null;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('SQLite checkpoint saver closed');
    }
  }
}

/**
 * Modern Checkpoint Manager with multiple storage backends
 */
export class ModernCheckpointManager {
  constructor(options = {}) {
    this.options = {
      backend: options.backend || 'sqlite', // 'sqlite', 'memory', 'file'
      dbPath: options.dbPath || './database/checkpoints.sqlite',
      enableAutoCleanup: options.enableAutoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 24 hours
      maxAge: options.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
      enableCompression: options.enableCompression || false,
      ...options
    };

    this.checkpointSaver = null;
    this.cleanupTimer = null;
    this.initialized = false;

    logger.info('ModernCheckpointManager initialized', {
      backend: this.options.backend,
      enableAutoCleanup: this.options.enableAutoCleanup
    });
  }

  /**
   * Initialize the checkpoint manager
   */
  async initialize() {
    try {
      // Create appropriate checkpoint saver based on backend
      switch (this.options.backend) {
        case 'sqlite':
          this.checkpointSaver = new SQLiteCheckpointSaver(this.options.dbPath);
          await this.checkpointSaver.initialize();
          break;
        
        case 'memory':
          // Use built-in memory saver
          const { MemorySaver } = await import('@langchain/langgraph');
          this.checkpointSaver = new MemorySaver();
          break;
        
        default:
          throw new Error(`Unsupported checkpoint backend: ${this.options.backend}`);
      }

      // Start auto-cleanup if enabled
      if (this.options.enableAutoCleanup) {
        this.startAutoCleanup();
      }

      this.initialized = true;
      logger.info('Checkpoint manager initialized successfully', {
        backend: this.options.backend
      });
    } catch (error) {
      logger.error('Failed to initialize checkpoint manager', {
        error: error.message,
        backend: this.options.backend
      });
      throw error;
    }
  }

  /**
   * Get the checkpoint saver instance
   */
  getCheckpointSaver() {
    if (!this.initialized) {
      throw new Error('Checkpoint manager not initialized. Call initialize() first.');
    }
    return this.checkpointSaver;
  }

  /**
   * Save a checkpoint
   */
  async saveCheckpoint(config, checkpoint, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const enhancedMetadata = {
        ...metadata,
        timestamp: Date.now(),
        version: '1.0.0',
        backend: this.options.backend
      };

      return await this.checkpointSaver.put(config, checkpoint, enhancedMetadata);
    } catch (error) {
      logger.error('Failed to save checkpoint', {
        error: error.message,
        threadId: config.configurable?.thread_id
      });
      throw error;
    }
  }

  /**
   * Load a checkpoint
   */
  async loadCheckpoint(config) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.checkpointSaver.get(config);
    } catch (error) {
      logger.error('Failed to load checkpoint', {
        error: error.message,
        threadId: config.configurable?.thread_id
      });
      throw error;
    }
  }

  /**
   * List checkpoints for a thread
   */
  async listCheckpoints(config, limit = 10, before = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.checkpointSaver.list(config, limit, before);
    } catch (error) {
      logger.error('Failed to list checkpoints', {
        error: error.message,
        threadId: config.configurable?.thread_id
      });
      throw error;
    }
  }

  /**
   * Delete checkpoints
   */
  async deleteCheckpoints(config) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.checkpointSaver.delete(config);
    } catch (error) {
      logger.error('Failed to delete checkpoints', {
        error: error.message,
        threadId: config.configurable?.thread_id
      });
      throw error;
    }
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup() {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        logger.error('Auto cleanup failed', { error: error.message });
      }
    }, this.options.cleanupInterval);

    logger.info('Auto cleanup started', {
      interval: this.options.cleanupInterval,
      maxAge: this.options.maxAge
    });
  }

  /**
   * Run cleanup manually
   */
  async runCleanup() {
    if (!this.initialized) {
      return 0;
    }

    try {
      if (this.checkpointSaver.cleanup) {
        const deletedCount = await this.checkpointSaver.cleanup(this.options.maxAge);
        logger.info('Manual cleanup completed', { deletedCount });
        return deletedCount;
      } else {
        logger.warn('Cleanup not supported for current backend', {
          backend: this.options.backend
        });
        return 0;
      }
    } catch (error) {
      logger.error('Manual cleanup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get checkpoint statistics
   */
  async getStatistics() {
    if (!this.initialized) {
      return null;
    }

    try {
      if (this.checkpointSaver.getStats) {
        const stats = await this.checkpointSaver.getStats();
        return {
          ...stats,
          backend: this.options.backend,
          autoCleanupEnabled: this.options.enableAutoCleanup,
          cleanupInterval: this.options.cleanupInterval,
          maxAge: this.options.maxAge
        };
      } else {
        return {
          backend: this.options.backend,
          message: 'Statistics not available for this backend'
        };
      }
    } catch (error) {
      logger.error('Failed to get checkpoint statistics', { error: error.message });
      return null;
    }
  }

  /**
   * Get health status
   */
  async getHealth() {
    try {
      return {
        status: this.initialized ? 'healthy' : 'not_initialized',
        backend: this.options.backend,
        autoCleanupEnabled: this.options.enableAutoCleanup,
        initialized: this.initialized
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        backend: this.options.backend
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Stop auto cleanup
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // Close checkpoint saver
      if (this.checkpointSaver && this.checkpointSaver.close) {
        await this.checkpointSaver.close();
      }

      this.initialized = false;
      logger.info('Checkpoint manager cleanup completed');
    } catch (error) {
      logger.error('Error during checkpoint manager cleanup', {
        error: error.message
      });
    }
  }
}

export default ModernCheckpointManager;