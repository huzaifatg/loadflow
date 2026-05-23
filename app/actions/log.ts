'use server';

import * as fs from 'fs';
import * as path from 'path';

export async function logToServer(label: string, data: unknown) {
  try {
    const logPath = path.join(process.cwd(), 'dnd-debug.log');
    const line = `[${new Date().toISOString()}] ${label}: ${JSON.stringify(data)}\n`;
    console.log(line); // Also print to next.js console
    fs.appendFileSync(logPath, line);
  } catch (err) {
    console.error("Failed to write log", err);
  }
}
