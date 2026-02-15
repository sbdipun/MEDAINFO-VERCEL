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
     * Format bitrate to human-readable (Kbps, Mbps)
     */
    formatBitrate(bps) {
        bps = parseFloat(bps);
        if (isNaN(bps) || bps === 0) return '0 bps';

        if (bps >= 1000000) {
            return `${(bps / 1000000).toFixed(2)} Mbps`;
        } else if (bps >= 1000) {
            return `${(bps / 1000).toFixed(0)} Kbps`;
        }
        return `${bps} bps`;
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
     * Format a value based on its key name
     */
    formatValue(key, value) {
        if (value === null || value === undefined || value === '') return value;

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
