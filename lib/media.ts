import path from 'node:path';

// shortcut: files live on one local volume, switch to object storage for multiple app instances.
export const mediaDirectory = path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_DIRECTORY || '.data/media');
