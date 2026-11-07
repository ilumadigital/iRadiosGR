// frontend/src/utils/streamHelper.js

export const getPlayableStreamUrl = (originalUrl) => {
    if (!originalUrl) return '';

    if (originalUrl.startsWith('http://') || originalUrl.match(/:\d+/)) {
        
        return `__IRADIOS_SITE_ORIGIN__/api/proxy-stream?url=${encodeURIComponent(originalUrl)}`;
    }

    return originalUrl;
};
