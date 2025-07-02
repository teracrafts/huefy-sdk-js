const { HuefyClient, EmailProvider } = require('@teracrafts/huefy');

/**
 * Basic usage example for the Huefy JavaScript SDK.
 * 
 * This example demonstrates:
 * 1. Creating a Huefy client
 * 2. Sending a single email
 * 3. Sending bulk emails
 * 4. Error handling
 * 5. Health checks
 */

async function main() {
    // Replace with your actual API key
    const apiKey = 'your-huefy-api-key';

    try {
        // Example 1: Basic client creation and single email
        console.log('=== Basic Email Sending ===');
        
        const client = new HuefyClient({
            apiKey: apiKey,
            baseUrl: 'https://api.huefy.com',
            timeout: 30000
        });

        const response = await client.sendEmail(
            'welcome-email',
            {
                name: 'John Doe',
                company: 'Acme Corporation',
                activationLink: 'https://app.example.com/activate/abc123'
            },
            'john@example.com',
            {
                provider: EmailProvider.SENDGRID
            }
        );

        console.log('✅ Email sent successfully!');
        console.log(`Message ID: ${response.messageId}`);
        console.log(`Provider: ${response.provider}`);
        console.log(`Status: ${response.status}\n`);

        // Example 2: Bulk email sending
        console.log('=== Bulk Email Sending ===');
        
        const bulkEmails = [
            {
                templateKey: 'newsletter',
                recipient: 'subscriber1@example.com',
                data: { name: 'Alice', content: 'Monthly Newsletter' }
            },
            {
                templateKey: 'newsletter',
                recipient: 'subscriber2@example.com',
                data: { name: 'Bob', content: 'Monthly Newsletter' }
            },
            {
                templateKey: 'newsletter',
                recipient: 'subscriber3@example.com',
                data: { name: 'Carol', content: 'Monthly Newsletter' }
            }
        ];

        const bulkResponse = await client.sendBulkEmails(bulkEmails);
        
        console.log('✅ Bulk email operation completed!');
        console.log(`Total emails: ${bulkResponse.totalEmails}`);
        console.log(`Successful: ${bulkResponse.successfulEmails}`);
        console.log(`Failed: ${bulkResponse.failedEmails}`);
        console.log(`Success rate: ${bulkResponse.successRate.toFixed(1)}%\n`);

        // Example 3: Health check
        console.log('=== API Health Check ===');
        
        const healthResponse = await client.healthCheck();
        
        if (healthResponse.status === 'healthy') {
            console.log('✅ API is healthy');
        } else {
            console.log('⚠️ API status:', healthResponse.status);
        }
        
        console.log(`Version: ${healthResponse.version}`);
        console.log(`Uptime: ${healthResponse.uptime} seconds\n`);

        // Example 4: Using different email providers
        console.log('=== Multiple Email Providers ===');
        
        const providers = [
            EmailProvider.SENDGRID,
            EmailProvider.MAILGUN,
            EmailProvider.SES,
            EmailProvider.MAILCHIMP
        ];

        for (const provider of providers) {
            try {
                const providerResponse = await client.sendEmail(
                    'test-template',
                    { message: `Testing with ${provider}` },
                    'test@example.com',
                    { provider }
                );
                
                console.log(`✅ ${provider}: ${providerResponse.messageId}`);
                
            } catch (error) {
                console.log(`❌ ${provider}: ${error.message}`);
            }
        }

        // Example 5: Custom configuration with retries
        console.log('\n=== Client with Custom Configuration ===');
        
        const customClient = new HuefyClient({
            apiKey: apiKey,
            baseUrl: 'https://api.huefy.com',
            timeout: 45000,
            retryOptions: {
                maxRetries: 5,
                baseDelay: 1000,
                maxDelay: 30000
            }
        });

        const customResponse = await customClient.sendEmail(
            'password-reset',
            {
                username: 'johndoe',
                resetLink: 'https://app.example.com/reset/xyz789',
                expiresAt: '2024-01-02 15:30:00'
            },
            'user@example.com'
        );

        console.log(`✅ Password reset email sent: ${customResponse.messageId}`);

    } catch (error) {
        // Handle different types of errors
        console.error('❌ Error occurred:', error.message);
        
        if (error.name === 'AuthenticationError') {
            console.error('💡 Please check your API key configuration.');
        } else if (error.name === 'ValidationError') {
            console.error('💡 Please check your request data.');
            console.error('Field:', error.field);
        } else if (error.name === 'NetworkError') {
            console.error('💡 Please check your network connection.');
        } else if (error.name === 'TimeoutError') {
            console.error('💡 Request timed out. Consider increasing timeout settings.');
        }
        
        if (error.context) {
            console.error('Context:', JSON.stringify(error.context, null, 2));
        }
    }

    console.log('\n=== Example completed ===');
}

// Run the example
main().catch(console.error);