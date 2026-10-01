import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

function canonicalPath(value: string): string {
  const resolved = path.resolve(value);
  if (fs.existsSync(resolved)) return fs.realpathSync(resolved);
  const parent = path.dirname(resolved);
  return parent === resolved ? resolved : path.join(canonicalPath(parent), path.basename(resolved));
}
export const getUploadsDir = (): string => {
  const uploads = canonicalPath(process.env.UPLOADS_DIR || (fs.existsSync('/app/uploads') ? '/app/uploads' : path.join(process.cwd(), 'uploads')));
  for (const publicDir of [canonicalPath('dist'), canonicalPath('public')]) {
    if (uploads === publicDir || uploads.startsWith(publicDir + path.sep) || publicDir.startsWith(uploads + path.sep)) throw new Error('UPLOADS_DIR must be outside public build directories.');
  }
  return uploads;
};

export const getDataDir = (): string => {
  const data = canonicalPath(process.env.DATA_DIR || path.join(process.cwd(), 'private-data'));
  const uploads = path.resolve(getUploadsDir());
  const publicDirs = [uploads, canonicalPath('dist'), canonicalPath('public')];
  for (const publicDir of publicDirs) {
    if (data === publicDir || data.startsWith(publicDir + path.sep) || publicDir.startsWith(data + path.sep)) {
      throw new Error('DATA_DIR must be separate from uploads and public build directories.');
    }
  }
  return data;
};

