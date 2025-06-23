# Modern F1 LangGraph Agents Deployment Guide

## Overview
This guide covers deploying the modernized F1 LangGraph Agents application using various Node.js deployment strategies without Docker.

## Prerequisites

### System Requirements
- Node.js 18+ (LTS recommended)
- npm 9+
- 2GB+ RAM
- 10GB+ disk space
- SSL certificate (for production)

### Required Environment Variables
```bash
# Core application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# AI Providers
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# F1 MCP Server
F1_MCP_SERVER_URL=https://f1-mcp-server-5dh3.onrender.com

# Feature Configuration
ENABLE_STREAMING=true
ENABLE_CHECKPOINTING=true
ENABLE_RATE_LIMITING=true
ENABLE_COMPRESSION=true
ENABLE_MONITORING=true

# Security
CORS_ORIGIN=https://yourdomain.com
REQUEST_TIMEOUT=180000
MAX_RETRIES=3

# Performance
METRICS_INTERVAL=30000
HEALTH_CHECK_INTERVAL=60000
```

## Deployment Options

### 1. Render.com Deployment (Recommended)

#### Step 1: Repository Setup
```bash
# Ensure your repository is on GitHub
git add .
git commit -m "Modern F1 LangGraph Agents ready for deployment"
git push origin main
```

#### Step 2: Render Service Configuration
Create `render.yaml`:
```yaml
services:
  - type: web
    name: f1-langgraph-agents-modern
    env: node
    plan: starter
    buildCommand: npm install
    startCommand: node src/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: OPENAI_API_KEY
        sync: false
      - key: F1_MCP_SERVER_URL
        value: https://f1-mcp-server-5dh3.onrender.com
      - key: ENABLE_STREAMING
        value: true
      - key: ENABLE_CHECKPOINTING
        value: true
    healthCheckPath: /health
    autoDeploy: false
```

#### Step 3: Deploy
1. Connect GitHub repository to Render
2. Configure environment variables in Render dashboard
3. Deploy service

### 2. Vercel Deployment

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Create `vercel.json`
```json
{
  "version": 2,
  "name": "f1-langgraph-agents-modern",
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "ENABLE_STREAMING": "true",
    "ENABLE_CHECKPOINTING": "true"
  },
  "functions": {
    "src/server.js": {
      "maxDuration": 300
    }
  }
}
```

#### Step 3: Deploy
```bash
vercel --prod
```

### 3. Railway Deployment

#### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

#### Step 2: Create `railway.toml`
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install"

[deploy]
startCommand = "node src/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[environments.production.variables]
NODE_ENV = "production"
ENABLE_STREAMING = "true"
ENABLE_CHECKPOINTING = "true"
```

#### Step 3: Deploy
```bash
railway login
railway link
railway up
```

### 4. Netlify Functions Deployment

#### Step 1: Create `netlify.toml`
```toml
[build]
  command = "npm install"
  functions = "netlify/functions"
  publish = "public"

[functions]
  node_bundler = "nft"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/server/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Step 2: Create Netlify Function
```javascript
// netlify/functions/server.js
import ModernF1Server from '../../src/server.js';

const server = new ModernF1Server({
  enableStreaming: false, // Limited in serverless
  enableCheckpointing: false
});

export const handler = async (event, context) => {
  await server.initialize();
  
  // Handle the request
  const { path, httpMethod, headers, body } = event;
  
  // Process request through Express app
  // Return appropriate response
};
```

### 5. Traditional VPS/Server Deployment

#### Step 1: Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash f1app
sudo mkdir -p /home/f1app/app
sudo chown f1app:f1app /home/f1app/app
```

#### Step 2: Application Deployment
```bash
# Switch to app user
sudo su - f1app

# Clone repository
cd /home/f1app/app
git clone https://github.com/your-username/F1-MCP-LANGGRAPH.git .
cd f1-langGraph-agents

# Install dependencies
npm install --production

# Create environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=your_key_here
F1_MCP_SERVER_URL=https://f1-mcp-server-5dh3.onrender.com
ENABLE_STREAMING=true
ENABLE_CHECKPOINTING=true
EOF
```

#### Step 3: PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'f1-langgraph-agents-modern',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

#### Step 4: Start Application
```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

#### Step 5: Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/f1-agents
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Monitoring and Maintenance

### Health Checks
```bash
# Check application health
curl -f http://localhost:3000/health

# Check detailed health
curl -f http://localhost:3000/health/detailed

# Monitor with PM2
pm2 monit
pm2 status
pm2 logs
```

### Log Management
```bash
# Rotate logs with logrotate
sudo cat > /etc/logrotate.d/f1-agents << EOF
/home/f1app/app/f1-langGraph-agents/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 f1app f1app
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### Automated Backups
```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/home/f1app/backups"
APP_DIR="/home/f1app/app/f1-langGraph-agents"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
tar -czf $BACKUP_DIR/database_$DATE.tar.gz -C $APP_DIR database/

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz -C $APP_DIR logs/

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### Performance Optimization

#### Memory Management
```javascript
// Add to modernServer.js for memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 800 * 1024 * 1024) { // 800MB
    logger.warn('High memory usage detected', memUsage);
  }
}, 60000);
```

#### CPU Optimization
```bash
# Set CPU affinity for better performance
pm2 start ecosystem.config.js --node-args="--max-old-space-size=1024" -i max
```

## Troubleshooting

### Common Issues
1. **Memory Leaks**: Monitor with `pm2 monit` and restart if needed
2. **Port Conflicts**: Ensure port 3000 is available
3. **Environment Variables**: Check with `pm2 env`
4. **SSL Issues**: Verify certificate paths and permissions

### Emergency Recovery
```bash
# Restart application
pm2 restart f1-langgraph-agents-modern

# Reset to stable version
git checkout stable-tag
npm install --production
pm2 reload all

# View recent logs
pm2 logs --lines 100
```

## Security Checklist

- [ ] Environment variables secured
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] CORS properly set
- [ ] Security headers added
- [ ] Regular security updates
- [ ] Access logs monitored
- [ ] Firewall configured

## Performance Metrics

### Expected Performance
- Response time: < 2 seconds (cached data)
- Memory usage: < 1GB
- CPU usage: < 50%
- Uptime: > 99.9%

### Monitoring Commands
```bash
# System resources
htop
df -h
free -m

# Application metrics
curl http://localhost:3000/analytics
curl http://localhost:3000/health/detailed

# PM2 monitoring
pm2 monit
pm2 status
```