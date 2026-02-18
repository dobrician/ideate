/**
 * Edge-compatible structured logger for Cloudflare Workers.
 *
 * When DEPLOY_TARGET=cloudflare, pino is unavailable (depends on fs/stream).
 * This module provides a compatible logger interface using console methods.
 */

type LogData = Record<string, unknown>;

function formatMsg(data: LogData | undefined, msg: string): string {
  if (!data || Object.keys(data).length === 0) return msg;
  return `${msg} ${JSON.stringify(data)}`;
}

export const edgeLogger = {
  info(data: LogData, msg: string) { console.info(formatMsg(data, msg)); },
  warn(data: LogData, msg: string) { console.warn(formatMsg(data, msg)); },
  error(data: LogData, msg: string) { console.error(formatMsg(data, msg)); },
  fatal(data: LogData, msg: string) { console.error(formatMsg(data, msg)); },
  debug(data: LogData, msg: string) { console.debug(formatMsg(data, msg)); },
};
