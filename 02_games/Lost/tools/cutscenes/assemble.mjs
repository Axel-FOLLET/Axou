/**
 * Assembles the video of cutscene 1 (the kitten's arrival): the chase (task 08), a black, the kitten's fall (this
 * task, or an AI version of it), a final black. Run from the project root, in WSL (ffmpeg and ffprobe on the PATH):
 *   node tools/cutscenes/assemble.mjs [options]
 *
 * Options (all optional):
 *   --chase <file>      chase segment (default .shots/cutscenes/arrival_chase/arrival_chase.mp4)
 *   --fall <file>       fall segment (default .shots/cutscenes/arrival_fall/arrival_fall.mp4); the AI trial passes its
 *                       own clip here, any size or frame rate is brought to 1280 x 720 at 30 images/s
 *   --out <file>        result (default public/videos/cutscene_arrival.mp4)
 *   --black-mid <s>     black between the chase and the fall (default 0.6)
 *   --black-end <s>     black after the fall, end of the cutscene (default 1.0)
 *   --crf <n>           x264 quality, lower is better (default 22)
 *   --maxrate <kbit/s>  ceiling on the bit rate, to keep the file small (default 3000)
 *   --json <file>       also write the offsets and the measurements of the result as JSON
 *   --allow-missing     a missing chase or fall file is replaced by nothing instead of stopping (a warning is printed)
 *
 * Output format, the same for the three cutscenes: H.264 (libx264), 1280 x 720, 30 images/s, yuv420p, +faststart, no
 * audio track. The offsets of every segment inside the result are printed (s), so a stage table can be matched to the
 * final video. Total duration expected: 40 to 60 s (a warning is printed outside this range).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Format shared by the three cutscene videos (commun.md section 2.1 of the mission). */
const FORMAT = { width: 1280, height: 720, fps: 30, pixFmt: 'yuv420p' };
/** Expected total length of cutscene 1 (s): 40 to 60, 45 aimed at. */
const LENGTH = { min: 40, max: 60 };
const DEFAULTS = {
  chase: '.shots/cutscenes/arrival_chase/arrival_chase.mp4',
  fall: '.shots/cutscenes/arrival_fall/arrival_fall.mp4',
  out: 'public/videos/cutscene_arrival.mp4',
  blackMid: 0.6,   // s: pause between the end of the flight and the first fragment of the fall
  blackEnd: 1.0,   // s: black held after the last fragment, end of the cutscene
  crf: 22,         // x264 quality; paint explosions and snow are noisy, so a ceiling (maxrate) also applies
  maxrate: 3000,   // kbit/s: 45 s at this ceiling stay under 17 MB, to keep the three videos under 30 MB
};

function parseArgs(argv) {
  const opts = { ...DEFAULTS, json: null, allowMissing: false };
  const numeric = { 'black-mid': 'blackMid', 'black-end': 'blackEnd', crf: 'crf', maxrate: 'maxrate' };
  const text = { chase: 'chase', fall: 'fall', out: 'out', json: 'json' };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, '');
    if (name === 'allow-missing') { opts.allowMissing = true; continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`[assemble] option ${argv[i - 1]} needs a value`);
    if (name in text) opts[text[name]] = value;
    else if (name in numeric) {
      opts[numeric[name]] = Number(value);
      if (!Number.isFinite(opts[numeric[name]])) throw new Error(`[assemble] ${argv[i - 1]} expects a number, got "${value}"`);
    } else throw new Error(`[assemble] unknown option ${argv[i - 1]}`);
  }
  return opts;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`[assemble] cannot run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`[assemble] ${cmd} failed (code ${r.status}):\n${r.stderr.split('\n').slice(-15).join('\n')}`);
  return r.stdout;
}

/** Measures a video: codec, size, frame rate, number of video frames, audio tracks, duration (s), file size (bytes). */
function probe(file) {
  const out = JSON.parse(run('ffprobe', [
    '-v', 'error', '-count_frames', '-show_entries',
    'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_read_frames',
    '-of', 'json', file,
  ]));
  const video = out.streams.find((s) => s.codec_type === 'video');
  if (!video) throw new Error(`[assemble] ${file} has no video stream`);
  const [num, den] = video.r_frame_rate.split('/').map(Number);
  return {
    codec: video.codec_name, width: video.width, height: video.height, fps: num / (den || 1), pixFmt: video.pix_fmt,
    frames: Number(video.nb_read_frames), audioTracks: out.streams.filter((s) => s.codec_type === 'audio').length,
    duration: Number(out.format.duration), bytes: Number(out.format.size),
  };
}

/** Segments in order; a black one has no file. `frames` is the length in output frames (30 images/s). */
function buildSegments(opts) {
  const segments = [];
  const addFile = (name, file) => {
    const abs = path.resolve(ROOT, file);
    if (!fs.existsSync(abs)) {
      if (!opts.allowMissing) throw new Error(`[assemble] ${name} file missing: ${file} (use --allow-missing to go on without it)`);
      console.warn(`[assemble] warning: ${name} file missing (${file}), left out`);
      return;
    }
    const info = probe(abs);
    segments.push({ name, file: abs, frames: Math.round((info.frames * FORMAT.fps) / info.fps), source: info });
  };
  const addBlack = (name, seconds) => { if (seconds > 0) segments.push({ name, file: null, frames: Math.round(seconds * FORMAT.fps) }); };
  addFile('chase', opts.chase);
  addBlack('black_mid', opts.blackMid);
  addFile('fall', opts.fall);
  addBlack('black_end', opts.blackEnd);
  return segments;
}

function encode(segments, opts) {
  const args = ['-y', '-v', 'error'];
  segments.forEach((s) => {
    if (s.file) args.push('-i', s.file);
    else args.push('-f', 'lavfi', '-i', `color=c=black:s=${FORMAT.width}x${FORMAT.height}:r=${FORMAT.fps}`);
  });
  // Every input is brought to the same size, frame rate and pixel format, cut to its exact frame count, then joined.
  const normalise = `fps=${FORMAT.fps},scale=${FORMAT.width}:${FORMAT.height}:flags=lanczos:force_original_aspect_ratio=decrease,`
    + `pad=${FORMAT.width}:${FORMAT.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=${FORMAT.pixFmt}`;
  const filters = segments.map((s, i) => `[${i}:v]${normalise},trim=end_frame=${s.frames},setpts=PTS-STARTPTS[v${i}]`);
  filters.push(`${segments.map((_, i) => `[v${i}]`).join('')}concat=n=${segments.length}:v=1:a=0[out]`);
  fs.mkdirSync(path.dirname(path.resolve(ROOT, opts.out)), { recursive: true });
  args.push(
    '-filter_complex', filters.join(';'), '-map', '[out]', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf),
    '-maxrate', `${opts.maxrate}k`, '-bufsize', `${opts.maxrate * 2}k`,
    '-pix_fmt', FORMAT.pixFmt, '-r', String(FORMAT.fps), '-movflags', '+faststart', path.resolve(ROOT, opts.out),
  );
  run('ffmpeg', args);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const segments = buildSegments(opts);
  if (segments.length === 0) throw new Error('[assemble] nothing to assemble');
  encode(segments, opts);

  const result = probe(path.resolve(ROOT, opts.out));
  let start = 0;
  const offsets = segments.map((s) => {
    const rel = s.file ? path.relative(ROOT, s.file) : null;
    const entry = { name: s.name, file: rel?.startsWith('..') ? s.file : rel, start: +start.toFixed(3), duration: +(s.frames / FORMAT.fps).toFixed(3) };
    start += s.frames / FORMAT.fps;
    return entry;
  });
  const report = { out: opts.out, result, segments: offsets };
  if (opts.json) fs.writeFileSync(path.resolve(ROOT, opts.json), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  const problems = [];
  if (result.codec !== 'h264') problems.push(`codec ${result.codec}`);
  if (result.width !== FORMAT.width || result.height !== FORMAT.height) problems.push(`size ${result.width}x${result.height}`);
  if (Math.abs(result.fps - FORMAT.fps) > 0.01) problems.push(`${result.fps} images/s`);
  if (result.pixFmt !== FORMAT.pixFmt) problems.push(`pixel format ${result.pixFmt}`);
  if (result.audioTracks) problems.push(`${result.audioTracks} audio track(s)`);
  if (result.duration < LENGTH.min || result.duration > LENGTH.max) problems.push(`duration ${result.duration.toFixed(1)} s outside ${LENGTH.min}-${LENGTH.max} s`);
  if (problems.length) console.warn(`[assemble] warning: ${problems.join('; ')}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
