import amqp, { Connection, Channel } from 'amqplib';

export enum QueueNames {
    URL_ANALYTICS = 'url_analytics',
    URL_CLICKS = 'url_clicks',
    USER_ACTIVITIES = 'user_activities',
    EMAIL_NOTIFICATIONS = 'email_notifications'
}

export interface UrlClickEvent {
    shortCode: string;
    urlId: string;
    originalUrl: string;
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    timestamp: Date;
    userId?: string;
}

export interface UrlAnalyticsEvent {
    urlId: string;
    userId: string;
    action: 'created' | 'updated' | 'deleted' | 'viewed';
    metadata?: any;
    timestamp: Date;
}

export interface UserActivityEvent {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: any;
    timestamp: Date;
}

class QueueService {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;

    constructor() {
        this.connect();
    }

    async connect(): Promise<void> {
        try {
            const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
            
            console.log('🐰 Connecting to RabbitMQ...');
            this.connection = await amqp.connect(rabbitMQUrl) as any;
            this.channel = await (this.connection as any).createChannel();
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            console.log('🟢 RabbitMQ connected successfully');

            // Setup connection event handlers
            this.connection!.on('error', (err: Error) => {
                console.error('🔴 RabbitMQ connection error:', err);
                this.isConnected = false;
                this.handleReconnect();
            });

            this.connection!.on('close', () => {
                console.log('🟡 RabbitMQ connection closed');
                this.isConnected = false;
                this.handleReconnect();
            });

            // Setup queues
            await this.setupQueues();
            
        } catch (error) {
            console.error('🔴 Failed to connect to RabbitMQ:', error);
            this.isConnected = false;
            this.handleReconnect();
        }
    }

    private async handleReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('🔴 Max reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`🔄 Attempting to reconnect to RabbitMQ in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    private async setupQueues(): Promise<void> {
        if (!this.channel) return;

        try {
            // Create queues
            const queues = Object.values(QueueNames);
            
            for (const queueName of queues) {
                await this.channel.assertQueue(queueName, {
                    durable: true, // Queue survives broker restarts
                    arguments: {
                        'x-message-ttl': 86400000, // 24 hours TTL
                    }
                });
            }

            console.log('📬 All queues created successfully');
            
        } catch (error) {
            console.error('🔴 Error setting up queues:', error);
        }
    }

    async publishMessage(queueName: QueueNames, message: any): Promise<boolean> {
        try {
            if (!this.isConnected || !this.channel) {
                console.warn('⚠️ RabbitMQ not connected, skipping message publish');
                return false;
            }

            const messageBuffer = Buffer.from(JSON.stringify(message));
            
            const sent = this.channel.sendToQueue(queueName, messageBuffer, {
                persistent: true, // Message survives broker restarts
                timestamp: Date.now(),
            });

            if (sent) {
                console.log(`📤 Message sent to queue ${queueName}`);
            } else {
                console.warn(`⚠️ Failed to send message to queue ${queueName}`);
            }

            return sent;
            
        } catch (error) {
            console.error(`🔴 Error publishing message to ${queueName}:`, error);
            return false;
        }
    }

    async consumeMessages(queueName: QueueNames, processor: (message: any) => Promise<void>): Promise<void> {
        try {
            if (!this.isConnected || !this.channel) {
                console.warn('⚠️ RabbitMQ not connected, cannot consume messages');
                return;
            }

            await this.channel.consume(queueName, async (msg: amqp.ConsumeMessage | null) => {
                if (!msg) return;

                try {
                    const messageContent = JSON.parse(msg.content.toString());
                    console.log(`📥 Processing message from queue ${queueName}`);
                    
                    await processor(messageContent);
                    
                    // Acknowledge message after successful processing
                    this.channel?.ack(msg);
                    console.log(`✅ Message processed successfully from queue ${queueName}`);
                    
                } catch (error) {
                    console.error(`🔴 Error processing message from ${queueName}:`, error);
                    
                    // Reject message and requeue
                    this.channel?.nack(msg, false, true);
                }
            }, {
                noAck: false // Manual acknowledgment
            });

            console.log(`👂 Started consuming messages from queue ${queueName}`);
            
        } catch (error) {
            console.error(`🔴 Error setting up consumer for ${queueName}:`, error);
        }
    }

    // Specific event publishers
    async publishUrlClick(event: UrlClickEvent): Promise<boolean> {
        return this.publishMessage(QueueNames.URL_CLICKS, event);
    }

    async publishUrlAnalytics(event: UrlAnalyticsEvent): Promise<boolean> {
        return this.publishMessage(QueueNames.URL_ANALYTICS, event);
    }

    async publishUserActivity(event: UserActivityEvent): Promise<boolean> {
        return this.publishMessage(QueueNames.USER_ACTIVITIES, event);
    }

    // Start consumers for different queues
    async startUrlClickConsumer(): Promise<void> {
        await this.consumeMessages(QueueNames.URL_CLICKS, async (message: UrlClickEvent) => {
            // Process URL click analytics
            console.log(`🔍 Processing URL click for ${message.shortCode}`, {
                originalUrl: message.originalUrl,
                timestamp: message.timestamp,
                userAgent: message.userAgent
            });
            
            // Here you can add logic to:
            // - Store detailed analytics in database
            // - Update click statistics
            // - Generate reports
            // - Send to external analytics services
        });
    }

    async startUrlAnalyticsConsumer(): Promise<void> {
        await this.consumeMessages(QueueNames.URL_ANALYTICS, async (message: UrlAnalyticsEvent) => {
            // Process URL analytics events
            console.log(`📊 Processing URL analytics for ${message.urlId}`, {
                action: message.action,
                userId: message.userId,
                timestamp: message.timestamp
            });
            
            // Here you can add logic to:
            // - Store analytics data
            // - Generate usage reports
            // - Update metrics
        });
    }

    async startUserActivityConsumer(): Promise<void> {
        await this.consumeMessages(QueueNames.USER_ACTIVITIES, async (message: UserActivityEvent) => {
            // Process user activity events
            console.log(`👤 Processing user activity for ${message.userId}`, {
                action: message.action,
                resource: message.resource,
                timestamp: message.timestamp
            });
            
            // Here you can add logic to:
            // - Audit logging
            // - User behavior analytics
            // - Security monitoring
        });
    }

    async startAllConsumers(): Promise<void> {
        try {
            await Promise.all([
                this.startUrlClickConsumer(),
                this.startUrlAnalyticsConsumer(),
                this.startUserActivityConsumer()
            ]);
            
            console.log('🎯 All queue consumers started successfully');
        } catch (error) {
            console.error('🔴 Error starting consumers:', error);
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            
            if (this.connection) {
                await (this.connection as any).close();
                this.connection = null;
            }
            
            this.isConnected = false;
            console.log('🟡 RabbitMQ disconnected');
            
        } catch (error) {
            console.error('🔴 Error disconnecting from RabbitMQ:', error);
        }
    }

    // Health check
    isHealthy(): boolean {
        return this.isConnected && this.channel !== null;
    }

    // Get queue info
    async getQueueInfo(queueName: QueueNames): Promise<any> {
        try {
            if (!this.isConnected || !this.channel) {
                return null;
            }

            return await this.channel.checkQueue(queueName);
        } catch (error) {
            console.error(`Error getting queue info for ${queueName}:`, error);
            return null;
        }
    }
}

// Export singleton instance
export const queueService = new QueueService();
export default queueService;
