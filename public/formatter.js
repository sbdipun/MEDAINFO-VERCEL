/**
 * MediaInfo Tree View Formatter
 * Converts raw MediaInfo values to human-readable formats
 */

const MediaInfoFormatter = {

    // Keys whose values are file sizes in bytes
    SIZE_KEYS: [
        'FileSize', 'StreamSize', 'Source_StreamSize',
        'File_Size', 'Stream_Size', 'FooterSize', 'HeaderSize'
    ],

    // Keys whose values are durations in seconds (or ms)
    DURATION_KEYS: [
        'Duration', 'Delay', 'Video_Delay',
        'Interleave_Duration', 'Source_Duration'
    ],

    // Keys whose values are bitrates in bps
    BITRATE_KEYS: [
        'BitRate', 'OverallBitRate', 'BitRate_Nominal',
        'BitRate_Maximum', 'BitRate_Minimum',
        'OverallBitRate_Maximum', 'OverallBitRate_Nominal'
    ],

    // Keys whose values are sample/frame rates
    RATE_KEYS: [
        'SamplingRate', 'FrameRate', 'FrameRate_Original',
        'FrameRate_Nominal', 'SamplingRate_Original'
    ],

    // ISO 639 Language codes mapping
    LANGUAGE_CODES: {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
        'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean',
        'ar': 'Arabic', 'hi': 'Hindi', 'bn': 'Bengali', 'pa': 'Punjabi', 'te': 'Telugu',
        'mr': 'Marathi', 'ta': 'Tamil', 'ur': 'Urdu', 'gu': 'Gujarati', 'kn': 'Kannada',
        'ml': 'Malayalam', 'th': 'Thai', 'vi': 'Vietnamese', 'tr': 'Turkish', 'pl': 'Polish',
        'uk': 'Ukrainian', 'ro': 'Romanian', 'nl': 'Dutch', 'el': 'Greek', 'cs': 'Czech',
        'sv': 'Swedish', 'hu': 'Hungarian', 'fi': 'Finnish', 'no': 'Norwegian', 'da': 'Danish',
        'bg': 'Bulgarian', 'hr': 'Croatian', 'sk': 'Slovak', 'sl': 'Slovenian', 'sr': 'Serbian',
        'he': 'Hebrew', 'id': 'Indonesian', 'ms': 'Malay', 'fa': 'Persian', 'af': 'Afrikaans',
        'sq': 'Albanian', 'am': 'Amharic', 'hy': 'Armenian', 'az': 'Azerbaijani', 'eu': 'Basque',
        'be': 'Belarusian', 'bs': 'Bosnian', 'ca': 'Catalan', 'et': 'Estonian', 'tl': 'Filipino',
        'ka': 'Georgian', 'is': 'Icelandic', 'ga': 'Irish', 'lv': 'Latvian', 'lt': 'Lithuanian',
        'mk': 'Macedonian', 'mt': 'Maltese', 'mn': 'Mongolian', 'ne': 'Nepali', 'sw': 'Swahili'
    },

    /**
     * Format bytes to human-readable size (KB, MB, GB, TB)
     */
    formatFileSize(bytes) {
        bytes = parseFloat(bytes);
        if (isNaN(bytes) || bytes === 0) return '0 Bytes';

        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = (bytes / Math.pow(k, i)).toFixed(2);

        return `${size} ${units[i]}`;
    },

    /**
     * Format seconds to HH:MM:SS.ms
     */
    formatDuration(seconds) {
        seconds = parseFloat(seconds);
        if (isNaN(seconds)) return seconds;

        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.round((seconds % 1) * 1000);

        const pad = (n, len = 2) => String(n).padStart(len, '0');

        if (hrs > 0) {
            return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
        }
        return `${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
    },

    /**
     * Format bitrate to Kbps (always in Kbps, not Mbps)
     */
    formatBitrate(bps) {
        bps = parseFloat(bps);
        if (isNaN(bps) || bps === 0) return '0 Kbps';

        const kbps = (bps / 1000).toFixed(0);
        return `${kbps} Kbps`;
    },

    /**
     * Format sample/frame rate
     */
    formatRate(rate, key) {
        rate = parseFloat(rate);
        if (isNaN(rate)) return rate;

        if (key && key.toLowerCase().includes('sample')) {
            if (rate >= 1000) {
                return `${(rate / 1000).toFixed(1)} KHz`;
            }
            return `${rate} Hz`;
        }
        return `${rate.toFixed(3)} fps`;
    },

    /**
     * Format language code to full name
     */
    formatLanguage(code) {
        if (!code || typeof code !== 'string') return code;
        const lowerCode = code.toLowerCase().trim();
        return this.LANGUAGE_CODES[lowerCode] || code;
    },

    /**
     * Format a value based on its key name
     */
    formatValue(key, value) {
        if (value === null || value === undefined || value === '') return value;

        // Language fields - check before numeric check
        if (key === 'Language' || key.includes('Language')) {
            return this.formatLanguage(value);
        }

        const strVal = String(value);

        // Check if value is numeric
        const numVal = parseFloat(strVal);
        const isNumeric = !isNaN(numVal) && isFinite(numVal);

        if (!isNumeric) return value;

        // Size fields
        if (this.SIZE_KEYS.some(k => key.includes(k))) {
            return this.formatFileSize(numVal);
        }

        // Duration fields
        if (this.DURATION_KEYS.some(k => key.includes(k))) {
            return this.formatDuration(numVal);
        }

        // Bitrate fields
        if (this.BITRATE_KEYS.some(k => key.includes(k))) {
            return this.formatBitrate(numVal);
        }

        // Rate fields
        if (this.RATE_KEYS.some(k => key.includes(k))) {
            return this.formatRate(numVal, key);
        }

        return value;
    }
};
