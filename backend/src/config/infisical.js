import { InfisicalSDK } from '@infisical/sdk';
import logger from '../services/logger.js';

/**
 * SoloCompass Infisical Integration (Node.js SDK v5 Official)
 * Pure Secret Retrieval Hub.
 */

const initInfisical = async () => {
    if (process.env.INFISICAL_ENABLED === 'false' || process.env.NODE_ENV === 'test') {
        logger.info('[Infisical] Secret management disabled via environment');
        return;
    }

    try {
        console.log('[Infisical] ENV Check - CLIENT_ID:', process.env.INFISICAL_CLIENT_ID);
        console.log('[Infisical] ENV Check - PROJECT_ID:', process.env.INFISICAL_PROJECT_ID);
        console.log('[Infisical] ENV Check - NODE_ENV:', process.env.NODE_ENV);
        
        if (!process.env.INFISICAL_CLIENT_ID || !process.env.INFISICAL_PROJECT_ID) {
            throw new Error('Missing required Infisical environment variables');
        }
        
        const client = new InfisicalSDK({
            siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com'
        });

        // 1: Authenticate
        await client.auth().universalAuth.login({
            clientId: process.env.INFISICAL_CLIENT_ID,
            clientSecret: process.env.INFISICAL_CLIENT_SECRET
        });
        
        console.log('[Infisical] Login successful!');

        const environment = (() => {
            const envMap = {
                production: 'prod',
                staging: 'staging',
                // 'preview' maps to the Infisical 'preview' environment.
                // Ensure a 'preview' environment exists in your Infisical project.
                preview: 'preview',
                development: 'dev',
            };
            return envMap[process.env.NODE_ENV] || 'dev';
        })();
        const projectId = process.env.INFISICAL_PROJECT_ID;

        // 2: Direct Secret Sync 
        // We skip ALL PROJECT LISTING as project-scoped identities are often restricted at the Org level.
        logger.info(`[Infisical] Synchronizing secrets for Project: ${projectId} [${environment}]...`);
        
        try {
            const result = await client.secrets().listSecrets({
                environment,
                projectId,
                secretPath: '/',
                includeImports: true
            });
            
            // SDK returns { secrets: [...], imports: [...] }
            const secretsList = result?.secrets || [];
            
            if (secretsList && secretsList.length > 0) {
                secretsList.forEach((secret) => {
                    process.env[secret.secretKey] = secret.secretValue;
                });
                logger.info(`[Infisical] Successfully injected ${secretsList.length} secrets.`);
                
                if (process.env.JWT_SECRET) {
                    logger.info('[Infisical] Security handshake verified: [JWT_SECRET] injected.');
                }
            } else {
                logger.warn(`[Infisical] WARNING: No secrets found in ${environment}. Verify permissions.`);
            }
        } catch (error) {
            // Enhanced descriptive error for 403 authorization blockers
            if (error.message.includes('403')) {
                logger.error('[Infisical] Access Denied: This Identity is restricted. (Check Project Role -> Secrets Permissions)');
            } else {
                logger.error(`[Infisical] Retrieval Error: ${error.message}`);
            }
            throw error;
        }

    } catch (error) {
        // Log but only kill process in production
        if (process.env.NODE_ENV === 'production') {
            logger.error(`[Infisical] FATAL: ${error.message}`);
            throw error;
        } else {
            logger.warn(`[Infisical] Initialization skipped: ${error.message}`);
        }
    }
};

export default initInfisical;
