import fs from 'fs';
import path from 'path';

const loadDotEnv = (): void => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, separatorIndex).trim();
    const value = trimmed.substring(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadDotEnv();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set.`);
  }
  return value;
};

const parseAllowedServers = (value: string): string[] => {
  const servers = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (servers.length === 0) {
    throw new Error('ALLOWED_SERVERS must include at least one server ID.');
  }
  return servers;
};

const config = {
  discordToken: requireEnv('DISCORD_TOKEN'),
  allowedServers: parseAllowedServers(requireEnv('ALLOWED_SERVERS')),
  mongodbUri: requireEnv('MONGODB_URI'),
};

export default config;
