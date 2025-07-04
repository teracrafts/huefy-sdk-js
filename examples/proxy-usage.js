/**
 * Example: Using Huefy JavaScript SDK with Enhanced Security
 * 
 * This example demonstrates how to use the JavaScript SDK with the optimized
 * proxy architecture for enhanced security and performance. The proxy handles
 * all API communication while the SDK focuses on application logic.
 */

import { HuefyClient } from '@teracrafts/huefy-sdk-js';

// The SDK automatically uses the optimized proxy architecture
// No additional configuration needed for standard usage

async function main() {
  // Create client - automatically uses secure proxy
  const huefy = new HuefyClient({
    apiKey: 'your-api-key',
    timeout: 30000,
    retryAttempts: 3,
  });

  try {
    // The JavaScript SDK automatically handles secure API communication
    // through the optimized proxy architecture
    const response = await huefy.sendEmail(
      'welcome-email',
      {
        name: 'John Doe',
        company: 'Acme Corp',
        activationLink: 'https://app.example.com/activate/12345'
      },
      'john@example.com'
    );

    console.log('Email sent successfully!');
    console.log('Message ID:', response.messageId);
    console.log('Provider used:', response.provider);
    
    // Check API health through proxy
    const health = await huefy.healthCheck();
    console.log('API Health:', health.status);
    
  } catch (error) {
    console.error('Failed to send email:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

// Benefits of Huefy's optimized architecture:
// 1. Security: API endpoints are secured and optimized
// 2. Performance: Intelligent routing and caching
// 3. Consistency: Unified behavior across all SDKs
// 4. Reliability: Built-in failover and redundancy

main().catch(console.error);