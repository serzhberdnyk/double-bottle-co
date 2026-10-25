/** Rasterize the original code-native DEMO SVG into the sixteen existing paths.
 * No operator image is read. Uses the project's pinned Next/sharp dependency.
 * Existing application runtime and structural image names are not altered.
 */
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const nextRequire=createRequire(require.resolve('next/package.json'));
const sharp=nextRequire('sharp');
const source='assets-source/demo-brochure-placeholder.svg';
const data=await sharp(await readFile(path.join(root,source))).jpeg({quality:90,progressive:false,chromaSubsampling:'4:4:4'}).toBuffer();
const paths=[];
for(const stem of ['4pearl','cheo1d','citytour','khaolak','ohosky','ohovip','simila','ttoa']){
  for(const suffix of ['','1']){
    const relative=`public/media/atime-${stem}${suffix}.jpg`;
    await writeFile(path.join(root,relative),data);paths.push(relative);
  }
}
console.log(JSON.stringify({source,sharp:sharp.versions.sharp,jpeg_sha256:createHash('sha256').update(data).digest('hex'),jpeg_bytes:data.length,paths},null,2));
