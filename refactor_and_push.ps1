$ErrorActionPreference = "Stop"

try {
    Write-Host "Starting Refactor..."

    # 1. Extract files
    $lines = Get-Content "public/index.html"
    
    # CSS: Lines 12-976 (Index 11..975)
    $lines[11..975] | Set-Content "public/styles.css" -Encoding UTF8
    
    # JS: Lines 1108-1575 (Index 1107..1574)
    $lines[1107..1574] | Set-Content "public/app.js" -Encoding UTF8

    # Remove indentation
    (Get-Content "public/styles.css") -replace '^ {8}', '' | Set-Content "public/styles.css" -Encoding UTF8
    (Get-Content "public/app.js") -replace '^ {8}', '' | Set-Content "public/app.js" -Encoding UTF8

    Write-Host "Files extracted and cleaned."

    # 2. Write new HTML
    $newHtml = @'
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaInfo Analyzer</title>
    <link rel="icon"
        href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
</head>

<body>
    <div class="container">
        <div class="header">
            <h1>🎬 MediaInfo API</h1>
            <p>Powered by mediainfo.js on Vercel Serverless Functions</p>
            <span class="badge" id="apiStatus">
                <span class="api-status status-offline" id="statusDot"></span>
                Checking API...
            </span>
            <button class="theme-toggle" id="themeToggle" title="Toggle dark/light mode"></button>
        </div>

        <div class="content">
            <div class="tabs">
                <div class="tab active" data-tab="url">URL Analysis</div>
                <div class="tab" data-tab="upload">File Upload</div>
            </div>

            <div class="input-section" id="urlTab">
                <div class="url-input-group">
                    <input type="url" class="url-input" id="urlInput"
                        placeholder="Enter direct media URL (MP4, MKV, MP3, etc.)">
                    <button class="analyze-btn" id="analyzeUrlBtn">
                        <span class="btn-text">Analyze URL</span>
                    </button>
                </div>
            </div>

            <div class="input-section" id="uploadTab" style="display: none;">
                <div class="url-input-group">
                    <input type="file" class="file-input" id="fileInput"
                        accept="video/*,audio/*,.mp4,.mkv,.avi,.mov,.mp3,.flac,.wav">
                    <button class="analyze-btn" id="analyzeFileBtn">
                        <span class="btn-text">Upload & Analyze</span>
                    </button>
                </div>
                <p style="color: #666; font-size: 14px; margin-top: 10px;">
                    📁 Max file size: 50MB (Vercel limit)
                </p>
            </div>

            <div class="progress-container" id="progressContainer">
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <div class="status-text" id="statusText">Processing...</div>
            </div>

            <div class="info-cards" id="infoPanel" style="display: none;">
                <div class="info-card">
                    <span class="info-icon">📄</span>
                    <div class="info-label">Filename</div>
                    <div class="info-value" id="fileName">-</div>
                </div>
                <div class="info-card">
                    <span class="info-icon">💾</span>
                    <div class="info-label">Size</div>
                    <div class="info-value" id="fileSize">-</div>
                </div>
                <div class="info-card">
                    <span class="info-icon">⚡</span>
                    <div class="info-label">Overall Bitrate</div>
                    <div class="info-value" id="overallBitrate">-</div>
                </div>
                <div class="info-card">
                    <span class="info-icon">✅</span>
                    <div class="info-label">Status</div>
                    <div class="info-value" id="analysisStatus">Ready</div>
                </div>
                <div class="info-card">
                    <span class="info-icon">🔗</span>
                    <div class="info-label">Method</div>
                    <div class="info-value" id="analysisMethod">-</div>
                </div>
            </div>

            <div class="results-section">
                <div class="results-header">
                    <h2>📊 Media Information</h2>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div class="format-selector">
                            <button class="format-btn active" data-format="tree">Tree View</button>
                            <button class="format-btn" data-format="summary">Summary</button>
                        </div>
                        <button class="analyze-btn" id="copyBtn" style="padding: 8px 16px; font-size: 14px;"
                            title="Copy to clipboard">
                            📋 Copy
                        </button>
                    </div>
                </div>

                <div class="media-info-box" id="mediaInfoBox">
                    <div class="skeleton-loader" id="skeletonLoader">
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line long"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line long"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line full"></div>
                        <div class="skeleton-line long"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line long"></div>
                        <div class="skeleton-line full"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line long"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line long"></div>
                    </div>
                    <pre id="mediaInfoContent">⚡ Enter a URL or upload a file to analyze</pre>
                </div>
            </div>

            <div class="error-box" id="errorBox"></div>

            <div class="footer">
                <span id="footerStatus">Ready</span> | mediainfo.js v0.1.9 | Vercel Serverless
            </div>
        </div>
    </div>

    <script src="formatter.js"></script>
    <script src="app.js"></script>
</body>

</html>
'@
    $newHtml | Set-Content "public/index.html" -Encoding UTF8
    Write-Host "Index.html updated."

    # 3. Git Operations
    Write-Host "Adding to git..."
    git add .
    
    Write-Host "Committing..."
    git commit -m "Refactor: Separated HTML, CSS, and JS files"
    
    Write-Host "Pushing..."
    git push

    Write-Host "Done!"
} catch {
    Write-Error "Error occurred: $_"
    exit 1
}
