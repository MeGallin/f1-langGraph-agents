import winston from 'winston';
import 'dotenv/config';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

// Define log format
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['timestamp', 'level', 'message'] })
);

const jsonFormat = winston.format.combine(
  customFormat,
  winston.format.json()
);

const simpleFormat = winston.format.combine(
  customFormat,
  winston.format.simple()
);

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat === 'json' ? jsonFormat : simpleFormat,
  defaultMeta: {
    service: 'f1-langgraph-agents',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Add file transport for production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    handleExceptions: true,
    handleRejections: true
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    handleExceptions: true,
    handleRejections: true
  }));
}

// Create request logger
export const requestLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'f1-langgraph-agents-requests'
  },
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;
