import { HuefyClient, EmailProvider, SendEmailOptions, HuefyConfig } from '@huefy-dev/sdk';

/**
 * TypeScript usage example for the Huefy SDK.
 * 
 * This example demonstrates TypeScript-specific features:
 * 1. Type-safe configuration
 * 2. Strongly typed data objects
 * 3. Generic error handling
 * 4. Interface usage
 */

interface UserData {
    name: string;
    email: string;
    company?: string;
}

interface WelcomeEmailData {
    name: string;
    company: string;
    activationLink: string;
    supportEmail: string;
}

interface NewsletterData {
    subscriberName: string;
    newsletterTitle: string;
    unsubscribeLink: string;
    articles: Array<{
        title: string;
        summary: string;
        url: string;
    }>;
}

async function sendWelcomeEmail(client: HuefyClient, user: UserData): Promise<void> {
    const emailData: WelcomeEmailData = {
        name: user.name,
        company: user.company || 'Your Organization',
        activationLink: `https://app.example.com/activate/${generateToken()}`,
        supportEmail: 'support@example.com'
    };

    const options: SendEmailOptions = {
        provider: EmailProvider.SENDGRID
    };

    try {
        const response = await client.sendEmail(
            'welcome-email',
            emailData,
            user.email,
            options
        );

        console.log(`Welcome email sent to ${user.name} (${response.messageId})`);
    } catch (error) {
        console.error(`Failed to send welcome email to ${user.name}:`, error);
        throw error;
    }
}

async function sendNewsletter(client: HuefyClient, subscribers: UserData[]): Promise<void> {
    const newsletterData: NewsletterData = {
        subscriberName: '', // Will be set per subscriber
        newsletterTitle: 'Weekly Tech Updates',
        unsubscribeLink: 'https://app.example.com/unsubscribe',
        articles: [
            {
                title: 'New Features Released',
                summary: 'Discover the latest features in our platform',
                url: 'https://blog.example.com/new-features'
            },
            {
                title: 'Performance Improvements',
                summary: 'Learn about our latest performance optimizations',
                url: 'https://blog.example.com/performance'
            }
        ]
    };

    const emailRequests = subscribers.map(subscriber => ({
        templateKey: 'newsletter',
        recipient: subscriber.email,
        data: {
            ...newsletterData,
            subscriberName: subscriber.name
        }
    }));

    try {
        const response = await client.sendBulkEmails(emailRequests);
        
        console.log(`Newsletter sent to ${response.successfulEmails}/${response.totalEmails} subscribers`);
        
        if (response.failedEmails > 0) {
            console.warn(`${response.failedEmails} emails failed to send`);
        }
        
        return response;
    } catch (error) {
        console.error('Failed to send newsletter:', error);
        throw error;
    }
}

async function main(): Promise<void> {
    // Type-safe configuration
    const config: HuefyConfig = {
        apiKey: process.env.HUEFY_API_KEY || 'your-api-key',
        baseUrl: 'https://api.huefy.com',
        timeout: 30000,
        retryOptions: {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
        }
    };

    const client = new HuefyClient(config);

    try {
        // Example 1: Send welcome emails
        console.log('=== Sending Welcome Emails ===');
        
        const newUsers: UserData[] = [
            { name: 'Alice Johnson', email: 'alice@example.com', company: 'Tech Corp' },
            { name: 'Bob Smith', email: 'bob@example.com', company: 'Startup Inc' },
            { name: 'Carol Davis', email: 'carol@example.com' }
        ];

        for (const user of newUsers) {
            await sendWelcomeEmail(client, user);
        }

        // Example 2: Send newsletter
        console.log('\n=== Sending Newsletter ===');
        
        const subscribers: UserData[] = [
            { name: 'John Doe', email: 'john@example.com' },
            { name: 'Jane Smith', email: 'jane@example.com' },
            { name: 'Mike Wilson', email: 'mike@example.com' }
        ];

        await sendNewsletter(client, subscribers);

        // Example 3: Health check with type safety
        console.log('\n=== Health Check ===');
        
        const health = await client.healthCheck();
        
        // TypeScript ensures we have the correct properties
        const statusInfo = {
            isHealthy: health.status === 'healthy',
            version: health.version,
            uptimeHours: Math.floor(health.uptime / 3600)
        };

        console.log('API Status:', statusInfo);

        // Example 4: Error handling with types
        console.log('\n=== Error Handling Example ===');
        
        try {
            // This will fail due to invalid email
            await client.sendEmail(
                'test-template',
                { message: 'Test' },
                'invalid-email-address',
                { provider: EmailProvider.SES }
            );
        } catch (error: any) {
            if (error.name === 'ValidationError') {
                console.log(`Validation failed: ${error.message}`);
                console.log(`Field: ${error.field}`);
            } else {
                console.log(`Unexpected error: ${error.message}`);
            }
        }

    } catch (error: any) {
        console.error('Application error:', error.message);
        
        // Type-safe error handling
        if ('statusCode' in error) {
            console.error(`HTTP Status: ${error.statusCode}`);
        }
        
        if ('context' in error && error.context) {
            console.error('Error context:', error.context);
        }
        
        process.exit(1);
    }

    console.log('\n=== TypeScript example completed ===');
}

function generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// Run the example
main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});