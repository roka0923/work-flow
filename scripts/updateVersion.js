import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFilePath = path.join(__dirname, '../src/config/version.json');
const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));

// 타임존 보정 (KST)
const now = new Date();
const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
const formattedDate = kstTime.toISOString().replace('T', ' ').substring(0, 16).replace(/-/g, '.');

// 버전 포맷: 1.3.X (빌드 번호 증가)
const versionParts = versionData.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');

const newVersionData = {
    version: newVersion,
    lastUpdated: formattedDate
};

fs.writeFileSync(versionFilePath, JSON.stringify(newVersionData, null, 4));

console.log(`Version updated to ${newVersion} (${formattedDate})`);
