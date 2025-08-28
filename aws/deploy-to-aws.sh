#!/bin/bash

# AWS Deployment Script for URL Shortener
# This script deploys your load-balanced URL shortener to AWS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AWS Deployment Script for URL Shortener${NC}"
echo "============================================="

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
STACK_NAME=${STACK_NAME:-"url-shortener"}
ECR_REPO_NAME=${ECR_REPO_NAME:-"url-shortener"}
DB_PASSWORD=${DB_PASSWORD:-"SecurePassword123!"}

echo -e "${YELLOW}Configuration:${NC}"
echo "  AWS Region: $AWS_REGION"
echo "  Stack Name: $STACK_NAME"
echo "  ECR Repo: $ECR_REPO_NAME"
echo ""

# Step 1: Check AWS CLI
echo -e "${YELLOW}1. Checking AWS CLI...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"

# Step 2: Create ECR Repository
echo -e "${YELLOW}2. Creating ECR Repository...${NC}"
ECR_URI=$(aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION --query 'repositories[0].repositoryUri' --output text 2>/dev/null || echo "")

if [ "$ECR_URI" = "" ]; then
    echo "Creating new ECR repository..."
    ECR_URI=$(aws ecr create-repository --repository-name $ECR_REPO_NAME --region $AWS_REGION --query 'repository.repositoryUri' --output text)
    echo -e "${GREEN}✅ ECR repository created: $ECR_URI${NC}"
else
    echo -e "${GREEN}✅ ECR repository exists: $ECR_URI${NC}"
fi

# Step 3: Build and Push Docker Image
echo -e "${YELLOW}3. Building and pushing Docker image...${NC}"

# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Build the image
echo "Building Docker image..."
docker build -t $ECR_REPO_NAME:latest -f Dockerfile .

# Tag for ECR
docker tag $ECR_REPO_NAME:latest $ECR_URI:latest

# Push to ECR
echo "Pushing to ECR..."
docker push $ECR_URI:latest

echo -e "${GREEN}✅ Docker image pushed to ECR${NC}"

# Step 4: Create/Update CloudFormation Stack
echo -e "${YELLOW}4. Deploying CloudFormation stack...${NC}"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &> /dev/null; then
    echo "Updating existing stack..."
    aws cloudformation update-stack \
        --stack-name $STACK_NAME \
        --template-body file://aws/cloudformation-template.yaml \
        --parameters ParameterKey=DBPassword,ParameterValue=$DB_PASSWORD \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION

    echo "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $AWS_REGION
else
    echo "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name $STACK_NAME \
        --template-body file://aws/cloudformation-template.yaml \
        --parameters ParameterKey=DBPassword,ParameterValue=$DB_PASSWORD \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION

    echo "Waiting for stack creation to complete..."
    aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $AWS_REGION
fi

echo -e "${GREEN}✅ CloudFormation stack deployed${NC}"

# Step 5: Update ECS Task Definition
echo -e "${YELLOW}5. Updating ECS Task Definition...${NC}"

# Get database and Redis endpoints
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' --output text)
REDIS_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' --output text)

# Update task definition with actual image URI
sed "s|YOUR_ECR_REPO/url-shortener:latest|$ECR_URI:latest|g" aws/ecs-task-definition.json > /tmp/task-definition.json

# Register task definition
aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-definition.json \
    --region $AWS_REGION

echo -e "${GREEN}✅ ECS Task Definition updated${NC}"

# Step 6: Update ECS Service
echo -e "${YELLOW}6. Updating ECS Service...${NC}"

CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' --output text)

aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service "$STACK_NAME-service" \
    --task-definition "url-shortener" \
    --region $AWS_REGION

echo "Waiting for service deployment to complete..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services "$STACK_NAME-service" \
    --region $AWS_REGION

echo -e "${GREEN}✅ ECS Service updated${NC}"

# Step 7: Get Application URL
echo -e "${YELLOW}7. Getting application URL...${NC}"

ALB_DNS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}Application URLs:${NC}"
echo "  🌐 Load Balancer: http://$ALB_DNS"
echo "  🏥 Health Check: http://$ALB_DNS/health"
echo ""
echo -e "${BLUE}AWS Resources:${NC}"
echo "  📊 CloudFormation Stack: $STACK_NAME"
echo "  🐳 ECR Repository: $ECR_URI"
echo "  ⚖️ Load Balancer: $ALB_DNS"
echo "  🚀 ECS Cluster: $CLUSTER_NAME"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Set up custom domain with Route 53"
echo "  2. Add SSL certificate with ACM"
echo "  3. Configure CloudWatch monitoring"
echo "  4. Set up CI/CD pipeline"
echo ""

# Clean up
rm -f /tmp/task-definition.json

echo -e "${GREEN}Deployment script completed! 🚀${NC}"
