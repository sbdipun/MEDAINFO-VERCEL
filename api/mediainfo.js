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

      // Check if this is a thumbnail generation request
      const bodyChunks = [];
      for await (const chunk of req) {
        bodyChunks.push(chunk);
      }
      const bodyBuffer = Buffer.concat(bodyChunks);
      
      // Reset the request stream by recreating the readable data
      try {
        const bodyString = bodyBuffer.toString();
        const bodyObj = JSON.parse(bodyString);
        
        if (bodyObj.action === 'generateThumbnails') {
          // Reset request for thumbnail handling
          req.headers['content-type'] = 'application/json';
          return await handleThumbnailGeneration(bodyBuffer, res, bodyObj);
        }
      } catch (e) {
        // Not JSON, continue with original logic
      }

      if (contentType.includes('multipart/form-data')) {
        // Handle file upload - reconstruct request with body
        const busboy = Busboy({ headers: req.headers });
        const chunks = [];
        let filename = '';

        busboy.on('file', (fieldname, file, info) => {
          filename = info.filename;
          file.on('data', (data) => {
            chunks.push(data);
          });
        });

        return new Promise((resolve) => {
          busboy.on('finish', async () => {
            try {
              const buffer = Buffer.concat(chunks);
              const mediaInfo = await analyzeWithMediaInfo(buffer);
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
              resolve(res.status(500).json({ error: error.message }));
            }
          });
          busboy.write(bodyBuffer);
          busboy.end();
        });
      } else {
        // Handle JSON with URL
        return await handleUrlAnalysis(bodyBuffer, res);
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

async function handleUrlAnalysis(bodyBuffer, res) {
  return new Promise(async (resolve) => {
    try {
      const bodyString = bodyBuffer.toString();
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
      // Convert Google Drive links to direct download
      let downloadUrl = url;
      if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        const patterns = [
          /\/file\/d\/([a-zA-Z0-9-_]+)/,
          /id=([a-zA-Z0-9-_]+)/,
          /\/open\?id=([a-zA-Z0-9-_]+)/
        ];
        let fileId = null;
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) {
            fileId = match[1];
            break;
          }
        }
        if (fileId) {
          downloadUrl = `https://gdl.anshumanpm.eu.org/direct.aspx?id=${fileId}`;
        }
      }

      // Download first 10MB
      const { buffer, filename, fileSize } = await downloadFirst10MB(downloadUrl);

      // Analyze with MediaInfo
      const mediaInfo = await analyzeWithMediaInfo(buffer);

      // Get file info
      const fileInfo = {
        url: url,
        filename: filename,
        size: fileSize,
        sizeFormatted: formatBytes(fileSize),
        type: 'url',
        isPartial: buffer.length < fileSize
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

    // Extract filename from Content-Disposition or URL
    let filename = 'unknown';
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    if (filename === 'unknown') {
      // Extract from URL
      const urlPath = new URL(url).pathname;
      filename = urlPath.split('/').pop() || 'unknown';
      // Decode URL encoding
      filename = decodeURIComponent(filename);
    }

    // Get total file size from Content-Length or Content-Range
    let fileSize = null;
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
      if (match) fileSize = parseInt(match[1]);
    }
    if (!fileSize) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) fileSize = parseInt(contentLength);
    }

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

      // Get filesize from full response if not already set
      if (!fileSize) {
        const fullContentLength = fullResponse.headers.get('content-length');
        if (fullContentLength) fileSize = parseInt(fullContentLength);
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

      return {
        buffer: Buffer.from(limitedBuffer),
        filename,
        fileSize: fileSize || arrayBuffer.byteLength
      };
    }

    // Range request succeeded - use arrayBuffer
    console.log('Range request succeeded, downloading...');
    const arrayBuffer = await response.arrayBuffer();
    console.log('Downloaded:', arrayBuffer.byteLength, 'bytes');

    clearTimeout(timeout);

    return {
      buffer: Buffer.from(arrayBuffer),
      filename,
      fileSize: fileSize || arrayBuffer.byteLength
    };

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

async function handleThumbnailGeneration(bodyBuffer, res, bodyObj) {
  try {
    const { fileBuffer, count, mode, customTimestamps } = bodyObj;
    
    if (!fileBuffer) {
      return res.status(400).json({ error: 'File buffer is required' });
    }

    const thumbCount = parseInt(count) || 5;
    const generationMode = mode || 'random'; // 'random' or 'timeline'

    // Convert base64 back to buffer
    const buffer = Buffer.from(fileBuffer, 'base64');

    // Generate thumbnails
    const thumbnails = await generateThumbnails(buffer, thumbCount, generationMode, customTimestamps);

    return res.status(200).json({
      success: true,
      count: thumbnails.length,
      thumbnails: thumbnails
    });
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return res.status(500).json({ 
      error: 'Thumbnail generation failed',
      message: error.message 
    });
  }
}

async function generateThumbnails(buffer, count, mode, customTimestamps) {
  return new Promise(async (resolve, reject) => {
    // For now, return placeholder since FFmpeg might not work perfectly on Vercel
    // In production, you'd use FFmpeg or external service
    
    if (!buffer || buffer.length === 0) {
      reject(new Error('Empty buffer provided'));
      return;
    }

    try {
      // Try to use FFmpeg if available
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegPath = require('ffmpeg-static');
      
      ffmpeg.setFfmpegPath(ffmpegPath);

      const tempDir = '/tmp';
      const inputPath = `${tempDir}/input_${Date.now()}.tmp`;
      const fs = require('fs');
      
      // Write buffer to temp file
      fs.writeFileSync(inputPath, buffer);

      const timestamps = [];
      const thumbnails = [];

      if (mode === 'random') {
        // Get random timestamps
        for (let i = 0; i < count; i++) {
          const randTime = Math.random();
          timestamps.push(randTime);
        }
      } else if (mode === 'timeline') {
        // Evenly distribute throughout the video
        for (let i = 0; i < count; i++) {
          const percent = (i + 1) / (count + 1);
          timestamps.push(percent);
        }
      } else if (customTimestamps && Array.isArray(customTimestamps)) {
        timestamps.push(...customTimestamps);
      }

      let completed = 0;

      const proc = ffmpeg(inputPath)
        .on('filenames', (filenames) => {
          console.log('Thumbnails will be saved as:', filenames);
        })
        .on('progress', (progress) => {
          console.log('Screenshot progress:', progress);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          // Cleanup
          try { fs.unlinkSync(inputPath); } catch (e) {}
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .on('end', () => {
          console.log('Thumbnails generated successfully');
          
          // Read generated thumbnail files
          try {
            const files = fs.readdirSync(tempDir).filter(f => f.startsWith('thumbnail_') && f.endsWith('.png'));
            
            files.forEach(file => {
              const filepath = `${tempDir}/${file}`;
              const imageBuffer = fs.readFileSync(filepath);
              const base64 = imageBuffer.toString('base64');
              thumbnails.push({
                index: thumbnails.length + 1,
                data: `data:image/png;base64,${base64}`,
                timestamp: timestamps[thumbnails.length]
              });
              try { fs.unlinkSync(filepath); } catch (e) {}
            });
            
            // Cleanup input file
            try { fs.unlinkSync(inputPath); } catch (e) {}
            
            resolve(thumbnails.length > 0 ? thumbnails : placeholderThumbnails(count));
          } catch (err) {
            console.error('Error reading thumbnails:', err);
            try { fs.unlinkSync(inputPath); } catch (e) {}
            resolve(placeholderThumbnails(count));
          }
        })
        .screenshots({
          count: count,
          folder: tempDir,
          filename: 'thumbnail_%i.png',
          size: '320x180'
        });

    } catch (error) {
      console.error('FFmpeg setup error:', error);
      // Return placeholder if FFmpeg fails
      resolve(placeholderThumbnails(count));
    }
  });
}

function placeholderThumbnails(count) {
  // Return placeholder PNG images when FFmpeg isn't available
  const placeholders = [];
  for (let i = 0; i < count; i++) {
    // 1x1 transparent PNG
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    
    placeholders.push({
      index: i + 1,
      data: `data:image/png;base64,${pngData.toString('base64')}`,
      timestamp: (i + 1) / (count + 1),
      isPlaceholder: true
    });
  }
  return placeholders;
}
