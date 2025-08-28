# 🌐 Load Balancing Guide - URL Shortener

Bhaiyo! Ye comprehensive guide hai nginx load balancing implementation ke liye. 🚀

## 📋 Quick Start

### 🏃‍♂️ Production Setup (3 instances + Load Balancer)
```bash
# Start everything
docker-compose up -d

# Test load balancing
./scripts/load-balancer-test.sh

# Check all services
docker-compose ps
```

### 🛠️ Development Setup (Single instance)
```bash
# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 🏗️ Architecture Overview

```
Internet → Nginx (Port 80) → Load Balancer → App Instances
                ↓
        [app1:8000] [app2:8000] [app3:8000]
                ↓
    Redis (6379) + RabbitMQ (5672) + PostgreSQL (5432)
```

### 🎯 Load Balancing Strategy

- **Algorithm**: Least Connections (least_conn)
- **Health Checks**: Every 30 seconds
- **Failover**: Automatic (3 failed attempts = mark as down)
- **Recovery**: Automatic (retry after 30 seconds)
- **Weights**: Equal (weight=1 for all instances)

## 📂 File Structure

```
url_shortner/
├── nginx/
│   ├── nginx.conf          # Production config (3 instances)
│   ├── nginx.dev.conf      # Development config (1 instance)
│   └── html/
│       ├── 50x.html        # Server error page
│       └── 404.html        # Not found page
├── scripts/
│   └── load-balancer-test.sh # Load balancing test script
├── Dockerfile              # Multi-stage app container
├── docker-compose.yml      # Production setup
└── docker-compose.dev.yml  # Development override
```

## ⚙️ Configuration Details

### 🔧 Nginx Configuration Highlights

```nginx
# Load balancing upstream
upstream url_shortener_backend {
    least_conn;  # Best for I/O intensive apps
    server app1:8000 max_fails=3 fail_timeout=30s weight=1;
    server app2:8000 max_fails=3 fail_timeout=30s weight=1;
    server app3:8000 max_fails=3 fail_timeout=30s weight=1;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=redirect_limit:10m rate=50r/s;
```

### 🐳 Docker Configuration

```yaml
# App Instance Template
app1:
  build:
    context: .
    target: production
  environment:
    - INSTANCE_ID=app1  # Unique identifier
    - PORT=8000
  healthcheck:
    test: ["CMD", "node", "-e", "http health check script"]
    interval: 30s
    timeout: 10s
    retries: 3
```

## 🧪 Testing Load Balancing

### 🔬 Automated Testing
```bash
# Run comprehensive test
./scripts/load-balancer-test.sh
```

### 🖐️ Manual Testing
```bash
# Test basic load balancing
for i in {1..10}; do
  curl -s http://localhost/health | jq '.instance.id'
done

# Test failover
docker-compose stop app1
curl http://localhost/health  # Should still work
docker-compose start app1

# Monitor real-time logs
docker-compose logs -f nginx app1 app2 app3
```

## 📊 Monitoring & Metrics

### 🏥 Health Check Endpoints

```bash
# Nginx health
GET http://localhost/nginx-health

# Application health (shows instance info)
GET http://localhost/health

# Individual instance health (production only)
# Direct access blocked by nginx
```

### 📈 Key Metrics to Monitor

1. **Request Distribution**
   - Requests per instance
   - Load balancing fairness
   - Response time per instance

2. **Health Status**
   - Instance uptime
   - Failed health checks
   - Failover events

3. **Performance**
   - Average response time
   - Concurrent connections
   - Throughput per instance

## 🚨 Troubleshooting

### ❌ Common Issues & Solutions

#### 1. Load Balancer Not Working
```bash
# Check nginx config
docker-compose exec nginx nginx -t

# Check nginx logs
docker-compose logs nginx

# Verify upstream servers
docker-compose ps | grep app
```

#### 2. Requests Going to Same Instance
```bash
# Verify least_conn is working
curl -s http://localhost/health | jq '.instance.id'

# Check nginx upstream config
docker-compose exec nginx cat /etc/nginx/nginx.conf | grep -A 10 upstream
```

#### 3. Instance Not Receiving Traffic
```bash
# Check instance health
docker-compose logs app1

# Manually test instance
docker-compose exec app1 curl localhost:8000/health

# Check nginx upstream status
# (Would need nginx_upstream_check module for detailed status)
```

#### 4. High Response Times
```bash
# Check individual instance performance
time curl http://localhost/health

# Monitor resource usage
docker stats

# Check for bottlenecks
docker-compose logs app1 | grep "slow\|timeout\|error"
```

## 🎛️ Advanced Configuration

### 🔧 Adding More Instances

1. **Add to docker-compose.yml**:
```yaml
app4:
  build:
    context: .
    target: production
  environment:
    - INSTANCE_ID=app4
    # ... other config same as app1-3
```

2. **Update nginx.conf**:
```nginx
upstream url_shortener_backend {
    least_conn;
    server app1:8000 max_fails=3 fail_timeout=30s weight=1;
    server app2:8000 max_fails=3 fail_timeout=30s weight=1;
    server app3:8000 max_fails=3 fail_timeout=30s weight=1;
    server app4:8000 max_fails=3 fail_timeout=30s weight=1;  # New instance
}
```

3. **Restart services**:
```bash
docker-compose up -d --scale app4=1
```

### ⚖️ Custom Load Balancing Algorithms

```nginx
# Round Robin (default)
upstream backend {
    server app1:8000;
    server app2:8000;
}

# Weighted Round Robin
upstream backend {
    server app1:8000 weight=3;  # Gets 3x more requests
    server app2:8000 weight=1;
}

# IP Hash (sticky sessions)
upstream backend {
    ip_hash;
    server app1:8000;
    server app2:8000;
}

# Least Connections (current setup)
upstream backend {
    least_conn;
    server app1:8000;
    server app2:8000;
}
```

### 🔒 SSL/HTTPS Setup

Uncomment SSL section in `nginx.conf`:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Rest of configuration...
}
```

## 📚 Performance Tuning

### 🚀 Nginx Optimizations

```nginx
# Worker processes
worker_processes auto;
worker_connections 1024;

# Keepalive connections
upstream backend {
    least_conn;
    server app1:8000 max_conns=100;
    keepalive 32;
}

# Caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
proxy_cache my_cache;
proxy_cache_valid 200 1m;
```

### 🏃‍♂️ Application Optimizations

```javascript
// Cluster mode for each instance
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Your app code
}
```

## 🔮 Production Checklist

### ✅ Pre-Production
- [ ] SSL certificates configured
- [ ] Domain name pointed to load balancer
- [ ] Health checks tuned for your response times
- [ ] Rate limits adjusted for expected traffic
- [ ] Monitoring setup (Prometheus/Grafana)
- [ ] Log aggregation configured
- [ ] Backup strategy for containers
- [ ] Security headers configured

### ✅ Go-Live
- [ ] Load testing completed
- [ ] Failover testing completed
- [ ] Performance benchmarks established
- [ ] Monitoring alerts configured
- [ ] Incident response plan ready

### ✅ Post-Production
- [ ] Monitor request distribution
- [ ] Track response times per instance
- [ ] Monitor error rates
- [ ] Scale instances based on load
- [ ] Regular health check maintenance

## 🎯 Load Testing

### 🔨 Using Apache Bench
```bash
# Test concurrent requests
ab -n 1000 -c 10 http://localhost/health

# Test URL creation (with auth)
ab -n 100 -c 5 -H "Authorization: Bearer your-token" \
   -p post_data.json -T application/json \
   http://localhost/api/urls/create
```

### 🔨 Using wrk
```bash
# High load test
wrk -t12 -c400 -d30s http://localhost/health

# Custom script for complex scenarios
wrk -t12 -c400 -d30s -s load_test.lua http://localhost/
```

## 🎊 Conclusion

Ye load balancing setup aapko deta hai:

🎯 **High Availability** - Multiple instances ensure no single point of failure  
🚀 **Better Performance** - Load distribution across instances  
🛡️ **Fault Tolerance** - Automatic failover and recovery  
📈 **Scalability** - Easy to add more instances  
🔧 **Flexibility** - Different algorithms for different needs  

Ab aapka URL shortener production-ready hai with enterprise-grade load balancing! 🚀

**Happy Load Balancing! 🎉**
