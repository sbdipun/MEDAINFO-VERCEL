import mediaInfoFactory from 'mediainfo.js';
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
  const maxSize = 5 * 1024 * 1024; // 5MB for faster processing

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 45000); // 45 second timeout

  try {
    console.log('Starting download from:', url);
    console.log('Max download size:', maxSize, 'bytes');

    // Try range request first
    const response = await fetch(url, {
      headers: {
        'Range': `bytes=0-${maxSize - 1}`,
        'User-Agent': 'Mozilla/5.0 (compatible; MediaInfo-Bot/1.0)'
      },
      signal: controller.signal
    });

    console.log('Response status:', response.status);
    console.log('Content-Length:', response.headers.get('content-length'));
    console.log('Accept-Ranges:', response.headers.get('accept-ranges'));

    if (!response.ok && response.status !== 206) {
      console.log('Range request failed, trying full request');
      clearTimeout(timeout);

      // Range not supported, download full file but limit size
      const timeout2 = setTimeout(() => controller.abort(), 45000);

      const fullResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MediaInfo-Bot/1.0)'
        },
        signal: controller.signal
      });

      if (!fullResponse.ok) {
        throw new Error(`HTTP ${fullResponse.status}: ${fullResponse.statusText}`);
      }

      // Use arrayBuffer for reliable download in serverless
      console.log('Downloading with arrayBuffer...');
      const arrayBuffer = await fullResponse.arrayBuffer();
      console.log('Downloaded:', arrayBuffer.byteLength, 'bytes');

      clearTimeout(timeout2);

      // Limit to maxSize
      const limitedBuffer = arrayBuffer.byteLength > maxSize
        ? arrayBuffer.slice(0, maxSize)
        : arrayBuffer;

      return Buffer.from(limitedBuffer);
    }

    // Range request succeeded - use arrayBuffer
    console.log('Range request succeeded, downloading...');
    const arrayBuffer = await response.arrayBuffer();
    console.log('Downloaded:', arrayBuffer.byteLength, 'bytes');

    clearTimeout(timeout);
    return Buffer.from(arrayBuffer);

  } catch (error) {
    clearTimeout(timeout);
    console.error('Download error:', error);

    if (error.name === 'AbortError') {
      throw new Error('Download timed out after 45 seconds - file may be too large or connection too slow');
    }
    throw new Error(`Download failed: ${error.message}`);
  }
}

// Helper function to convert Node.js stream to buffer with size limit
async function streamToBuffer(stream, maxSize) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let downloaded = 0;
    let lastLog = Date.now();

    stream.on('data', (chunk) => {
      if (downloaded < maxSize) {
        const remaining = maxSize - downloaded;
        const dataToAdd = chunk.slice(0, Math.min(chunk.length, remaining));
        chunks.push(dataToAdd);
        downloaded += dataToAdd.length;

        // Log progress every 1MB or when complete
        const now = Date.now();
        if (now - lastLog > 2000 || downloaded >= maxSize) {
          console.log(`Downloaded: ${downloaded} / ${maxSize} bytes (${Math.round(downloaded / maxSize * 100)}%)`);
          lastLog = now;
        }

        // Stop reading if we've reached the limit
        if (downloaded >= maxSize) {
          stream.destroy(); // Stop the stream
          console.log('Download limit reached, stopping stream');
        }
      }
    });

    stream.on('end', () => {
      console.log('Stream ended, total downloaded:', downloaded);
      if (downloaded === 0) {
        reject(new Error('No data received from stream'));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      reject(error);
    });
  });
}

async function analyzeWithMediaInfo(buffer) {
  let mediaInfo = null;

  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid buffer provided');
    }

    console.log('=== MediaInfo Initialization Start ===');
    console.log('Buffer size:', buffer.length);
    console.log('Current directory:', process.cwd());
    console.log('__dirname:', __dirname);

    // Initialize MediaInfo using factory function with locateFile option
    mediaInfo = await mediaInfoFactory({
      format: 'object', // Return as object (default)
      locateFile: (filename) => {
        console.log('MediaInfo requesting file:', filename);

        // Try multiple possible locations
        const possiblePaths = [
          path.join(process.cwd(), 'node_modules', 'mediainfo.js', 'dist', filename),
          path.join(__dirname, '..', 'node_modules', 'mediainfo.js', 'dist', filename),
          path.join('/var/task', 'node_modules', 'mediainfo.js', 'dist', filename),
          filename
        ];

        console.log('Checking paths for WASM file:');

        // Check if fs module is available
        let fs;
        try {
          fs = require('fs'); // Use require for synchronous loading in Node.js context
        } catch (e) {
          console.log('fs module not available, using first path');
          return possiblePaths[0];
        }

        for (const testPath of possiblePaths) {
          console.log(`  - ${testPath}`);
          try {
            if (fs.existsSync(testPath)) {
              console.log(`  ✓ Found at: ${testPath}`);
              return testPath;
            }
          } catch (e) {
            console.log(`  ✗ Error checking: ${e.message}`);
          }
        }

        console.log('WASM file not found in any location, using first path as fallback');
        return possiblePaths[0];
      }
    });

    console.log('MediaInfo factory completed successfully');

    // Define getSize function (required by analyzeData)
    const getSize = () => buffer.length;

    // Define readChunk function (required by analyzeData)
    const readChunk = (chunkSize, offset) => {
      const end = Math.min(offset + chunkSize, buffer.length);
      return new Uint8Array(buffer.slice(offset, end));
    };

    console.log('Starting media analysis...');

    // Analyze data using official API
    const result = await mediaInfo.analyzeData(getSize, readChunk);

    console.log('Analysis complete, result type:', typeof result);

    if (!result) {
      throw new Error('MediaInfo returned no data');
    }

    // Result is already an object when format: 'object' is used
    return result;

  } catch (error) {
    console.error('MediaInfo analysis error:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Analysis failed: ${error.message}`);
  } finally {
    // Always close MediaInfo instance to free resources
    if (mediaInfo) {
      try {
        mediaInfo.close();
        console.log('MediaInfo instance closed');
      } catch (closeError) {
        console.error('Error closing MediaInfo:', closeError);
      }
    }
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
