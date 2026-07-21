/**
 * Stdin pipe input support for CLI commands.
 *
 * Allows commands to receive input from stdin pipes:
 *   echo '{"projectPath":"./test.ofp"}' | of render --stdin
 *   cat video.mp4 | of analyze --stdin -t quality
 */

export interface StdinOptions {
  /** Read input from stdin instead of file */
  stdin?: boolean;
  /** Expected input format */
  format?: 'json' | 'binary';
  /** Max bytes to read from stdin */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Check if stdin has data available (is piped).
 */
export function hasStdinData(): boolean {
  try {
    return !process.stdin.isTTY;
  } catch {
    return false;
  }
}

/**
 * Read all data from stdin as a string.
 */
export async function readStdinString(maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    process.stdin.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error(`stdin input exceeds maximum size (${maxBytes} bytes)`));
        return;
      }
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    process.stdin.on('error', (err) => {
      reject(new Error(`Failed to read stdin: ${err.message}`));
    });

    // Set a timeout for stdin
    const timeout = setTimeout(() => {
      reject(new Error('stdin read timeout (30s)'));
    }, 30_000);

    process.stdin.on('end', () => clearTimeout(timeout));
    process.stdin.on('error', () => clearTimeout(timeout));
  });
}

/**
 * Read all data from stdin as a Buffer.
 */
export async function readStdinBuffer(maxBytes = DEFAULT_MAX_BYTES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    process.stdin.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error(`stdin input exceeds maximum size (${maxBytes} bytes)`));
        return;
      }
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    process.stdin.on('error', (err) => {
      reject(new Error(`Failed to read stdin: ${err.message}`));
    });
  });
}

/**
 * Read JSON from stdin and parse it.
 */
export async function readStdinJson<T = unknown>(maxBytes?: number): Promise<T> {
  const raw = await readStdinString(maxBytes);
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`Failed to parse stdin JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Save stdin content to a temp file and return the path.
 */
export async function stdinToTempFile(extension = 'tmp', maxBytes?: number): Promise<string> {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');

  const data = await readStdinBuffer(maxBytes);
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `of-stdin-${Date.now()}.${extension}`);

  await fs.writeFile(tmpFile, data);
  return tmpFile;
}

/**
 * Add stdin options to a commander command.
 */
export function addStdinOptions(cmd: { option: (flags: string, description: string, defaultValue?: unknown) => unknown }): void {
  cmd.option('--stdin', 'Read input from stdin pipe', false);
  cmd.option('--stdin-format <format>', 'stdin input format (json|binary)', 'json');
}
