import { registerAs } from '@nestjs/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && nodeEnv === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv,
  jwtSecret: jwtSecret || 'dev_only_secret_DO_NOT_USE_IN_PROD',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  pythonBin: process.env.PYTHON_BIN || 'python3',
  optimizerPath: process.env.OPTIMIZER_PATH || '',
}));
