import { MediaInfo } from 'mediainfo.js';
import fetch from 'node-fetch';
import Busboy from 'busboy';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb'
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Handle different request types
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        // Handle file upload
        return await handleFileUpload(req, res);
      } else {
        // Handle JSON with URL
        return await handleUrlAnalysis(req, res);
      }
    } else if (req.method === 'GET') {
      // Health check
      return res.status(200).json({
        status: 'ok',
        message: 'MediaInfo API is running',
        version: '1.0.0',
        endpoints: {
          POST: '/api/mediainfo - Upload file or send JSON with URL'
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function handleFileUpload(req, res) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const chunks = [];
    let filename = '';

    busboy.on('file', (fieldname, file, info) => {
      filename = info.filename;
      file.on('data', (data) => {
        chunks.push(data);
      });
    });

    busboy.on('finish', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // Analyze with MediaInfo
        const mediaInfo = await analyzeWithMediaInfo(buffer);

        // Get file info
        const fileInfo = {
          filename: filename,
          size: buffer.length,
          sizeFormatted: formatBytes(buffer.length),
          type: 'upload'
        };

        resolve(res.status(200).json({
          success: true,
          fileInfo: fileInfo,
          data: mediaInfo
        }));
      } catch (error) {
        reject(res.status(500).json({ error: error.message }));
      }
    });

    req.pipe(busboy);
  });
}

async function handleUrlAnalysis(req, res) {
  return new Promise(async (resolve) => {
    try {
      // Read body
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const bodyString = Buffer.concat(chunks).toString();
          if (!bodyString) {
            return resolve(res.status(400).json({ error: 'Empty request body' }));
          }

          let body;
          try {
            body = JSON.parse(bodyString);
          } catch (parseError) {
            return resolve(res.status(400).json({
              error: 'Invalid JSON in request body',
              details: parseError.message
            }));
          }

          const { url } = body;

          if (!url) {
            return resolve(res.status(400).json({ error: 'URL is required' }));
          }

          // Validate URL
          try {
            new URL(url);
          } catch {
            return resolve(res.status(400).json({ error: 'Invalid URL' }));
          }

          // Download first 10MB
          const buffer = await downloadFirst10MB(url);

          // Analyze with MediaInfo
          const mediaInfo = await analyzeWithMediaInfo(buffer);

          // Get file info
          const fileInfo = {
            url: url,
            filename: url.split('/').pop() || 'unknown',
            size: buffer.length,
            sizeFormatted: formatBytes(buffer.length),
            type: 'url',
            isPartial: buffer.length < 10 * 1024 * 1024
          };

          return resolve(res.status(200).json({
            success: true,
            fileInfo: fileInfo,
            data: mediaInfo
          }));

        } catch (error) {
          return resolve(res.status(500).json({ error: error.message }));
        }
      });
    } catch (error) {
      return resolve(res.status(500).json({ error: error.message }));
    }
  });
}

async function downloadFirst10MB(url) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const chunks = [];
  let downloaded = 0;

  try {
    const response = await fetch(url, {
      headers: {
        'Range': `bytes=0-${maxSize - 1}`,
        'User-Agent': 'Mozilla/5.0 (compatible; MediaInfo-Bot/1.0)'
      },
      timeout: 30000
    });

    if (!response.ok && response.status !== 206) {
      // If range not supported, try regular download with limit
      const regularResponse = await fetch(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MediaInfo-Bot/1.0)'
        }
      });

      if (!regularResponse.ok) {
        throw new Error(`HTTP ${regularResponse.status}: ${regularResponse.statusText}`);
      }

      const reader = regularResponse.body.getReader();

      while (downloaded < maxSize) {
        const { done, value } = await reader.read();
        if (done) break;

        const remaining = maxSize - downloaded;
        const chunk = value.slice(0, Math.min(value.length, remaining));
        chunks.push(chunk);
        downloaded += chunk.length;

        if (downloaded >= maxSize) break;
      }

      reader.releaseLock();
    } else {
      const reader = response.body.getReader();

      while (downloaded < maxSize) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        downloaded += value.length;
      }

      reader.releaseLock();
    }

    if (downloaded === 0) {
      throw new Error('No data received');
    }

    return Buffer.concat(chunks);

  } catch (error) {
    console.error('Download error:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
}

async function analyzeWithMediaInfo(buffer) {
  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid buffer provided');
    }

    // Initialize MediaInfo with locateFile option for Vercel serverless
    const MediaInfoLib = await MediaInfo({
      locateFile: (file) => {
        // In Vercel serverless, try multiple possible locations
        console.log('MediaInfo requesting file:', file);

        // Try relative to this API file
        const paths = [
          path.join(__dirname, '..', 'node_modules', 'mediainfo.js', 'dist', file),
          path.join(process.cwd(), 'node_modules', 'mediainfo.js', 'dist', file),
          file // fallback to default
        ];

        console.log('Checking WASM paths:', paths);
        return paths[0]; // Return first path, MediaInfo will handle if it doesn't exist
      }
    });

    // Create read chunk function
    const readChunk = (size, offset) => {
      return buffer.slice(offset, Math.min(offset + size, buffer.length));
    };

    // Analyze data
    const result = await MediaInfoLib.analyzeData(
      () => buffer.length,
      readChunk,
      { format: 'JSON' }
    );

    // Validate and parse result
    if (!result) {
      throw new Error('MediaInfo returned no data');
    }

    // If result is a string, validate and parse it
    if (typeof result === 'string') {
      // Check if string looks like an error message (not JSON)
      if (result.startsWith('A server') || result.startsWith('Error') || !result.trim().startsWith('{')) {
        throw new Error(`MediaInfo error: ${result}`);
      }

      try {
        const parsed = JSON.parse(result);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid MediaInfo data structure');
        }
        return parsed;
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Result string:', result.substring(0, 200));
        throw new Error(`Failed to parse MediaInfo result: ${parseError.message}`);
      }
    }

    // If result is already an object, validate it
    if (typeof result === 'object') {
      return result;
    }

    throw new Error(`Unexpected result type: ${typeof result}`);

  } catch (error) {
    console.error('MediaInfo analysis error:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
