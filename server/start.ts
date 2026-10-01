import { startServer } from '../server';
startServer().catch(() => { console.error('Startup failed. Check PostgreSQL migrations, private storage, and HTTPS configuration.'); process.exitCode = 1; });
