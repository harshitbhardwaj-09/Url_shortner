#!/bin/bash

# Load Balancer Test Script for URL Shortener
# This script tests the load balancing functionality

echo "🚀 Load Balancer Test Script for URL Shortener"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost"
HEALTH_ENDPOINT="/health"
NGINX_HEALTH_ENDPOINT="/nginx-health"

echo -e "${BLUE}Testing Load Balancer Setup...${NC}\n"

# Test 1: Nginx Health Check
echo -e "${YELLOW}1. Testing Nginx Health Check...${NC}"
nginx_response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL$NGINX_HEALTH_ENDPOINT)
if [ "$nginx_response" = "200" ]; then
    echo -e "${GREEN}✅ Nginx is healthy (HTTP $nginx_response)${NC}"
else
    echo -e "${RED}❌ Nginx health check failed (HTTP $nginx_response)${NC}"
fi

echo ""

# Test 2: Backend Health Checks (multiple requests to see load balancing)
echo -e "${YELLOW}2. Testing Backend Health Checks (Load Balancing)...${NC}"
echo "Making 10 requests to see which instances respond:"

instances=()
for i in {1..10}; do
    response=$(curl -s $BASE_URL$HEALTH_ENDPOINT)
    instance_id=$(echo $response | jq -r '.instance.id' 2>/dev/null)
    hostname=$(echo $response | jq -r '.instance.hostname' 2>/dev/null)
    
    if [ "$instance_id" != "null" ] && [ "$instance_id" != "" ]; then
        echo -e "Request $i: Instance ${GREEN}$instance_id${NC} (hostname: $hostname)"
        instances+=("$instance_id")
    else
        echo -e "Request $i: ${RED}Failed to get instance info${NC}"
    fi
    sleep 0.5
done

echo ""

# Analyze load distribution
echo -e "${YELLOW}3. Load Distribution Analysis:${NC}"
unique_instances=($(printf "%s\n" "${instances[@]}" | sort -u))
total_requests=${#instances[@]}

for instance in "${unique_instances[@]}"; do
    count=$(printf "%s\n" "${instances[@]}" | grep -c "^$instance$")
    percentage=$((count * 100 / total_requests))
    echo -e "Instance ${GREEN}$instance${NC}: $count/$total_requests requests (${percentage}%)"
done

echo ""

# Test 3: Rate Limiting
echo -e "${YELLOW}4. Testing Rate Limiting...${NC}"
echo "Making rapid requests to test rate limiting:"

rate_limit_hit=false
for i in {1..15}; do
    response_code=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL$HEALTH_ENDPOINT)
    if [ "$response_code" = "429" ]; then
        echo -e "Request $i: ${YELLOW}Rate limited (HTTP 429)${NC}"
        rate_limit_hit=true
        break
    else
        echo -e "Request $i: ${GREEN}Success (HTTP $response_code)${NC}"
    fi
    sleep 0.1
done

if [ "$rate_limit_hit" = true ]; then
    echo -e "${GREEN}✅ Rate limiting is working correctly${NC}"
else
    echo -e "${YELLOW}⚠️  Rate limiting not triggered (might need faster requests)${NC}"
fi

echo ""

# Test 4: Service Status
echo -e "${YELLOW}5. Service Status Check...${NC}"
health_response=$(curl -s $BASE_URL$HEALTH_ENDPOINT)
status=$(echo $health_response | jq -r '.status' 2>/dev/null)
redis_status=$(echo $health_response | jq -r '.services.redis' 2>/dev/null)
rabbitmq_status=$(echo $health_response | jq -r '.services.rabbitmq' 2>/dev/null)
database_status=$(echo $health_response | jq -r '.services.database' 2>/dev/null)

echo -e "Overall Status: ${GREEN}$status${NC}"
echo -e "Redis: ${GREEN}$redis_status${NC}"
echo -e "RabbitMQ: ${GREEN}$rabbitmq_status${NC}"
echo -e "Database: ${GREEN}$database_status${NC}"

echo ""

# Test 5: Load Balancer Failure Simulation
echo -e "${YELLOW}6. Testing High Availability...${NC}"
echo "This test would require stopping one app instance to see failover."
echo "To test manually:"
echo -e "  ${BLUE}docker-compose stop app1${NC}"
echo -e "  ${BLUE}curl $BASE_URL$HEALTH_ENDPOINT${NC} (should still work)"
echo -e "  ${BLUE}docker-compose start app1${NC}"

echo ""

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Load Balancer Test Summary${NC}"
echo -e "${BLUE}================================${NC}"

if [ ${#unique_instances[@]} -gt 1 ]; then
    echo -e "${GREEN}✅ Load balancing is working (${#unique_instances[@]} instances detected)${NC}"
else
    echo -e "${YELLOW}⚠️  Only 1 instance detected (might be development mode)${NC}"
fi

if [ "$nginx_response" = "200" ]; then
    echo -e "${GREEN}✅ Nginx proxy is healthy${NC}"
else
    echo -e "${RED}❌ Nginx proxy issues detected${NC}"
fi

if [ "$status" = "OK" ]; then
    echo -e "${GREEN}✅ All backend services are healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Some backend services might have issues${NC}"
fi

echo ""
echo -e "${BLUE}Additional URLs to check:${NC}"
echo -e "  📊 Application: $BASE_URL"
echo -e "  🏥 Health Check: $BASE_URL$HEALTH_ENDPOINT"
echo -e "  🔴 Redis Commander: http://localhost:8081"
echo -e "  🐰 RabbitMQ Management: http://localhost:15672 (admin/admin123)"
echo -e "  📈 Nginx Status: $BASE_URL/nginx-status (internal only)"

echo ""
echo -e "${GREEN}🎉 Load balancer test completed!${NC}"
