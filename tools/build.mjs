// Bundles the player into one self-contained file: dist/index.html (and a copy in docs/ for GitHub Pages)
//   node tools/build.mjs            build once
//   node tools/build.mjs --serve    rebuild on change and serve on http://localhost:8080
//   node tools/build.mjs --lrc=my.lrc [--personal=out/personal/player.html]
//        also writes a personal copy with your own lyrics built in (never into dist/ or docs/,
//        so lyrics don't end up in the repository or on a published page)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const serve = process.argv.includes('--serve');
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.replace(/^--/, '').split(/=(.*)/s)));
mkdirSync('dist', { recursive: true });

const inline = {
  name: 'inline-html',
  setup(build) {
    build.onEnd(res => {
      if (res.errors.length) return;
      const js = res.outputFiles.find(f => f.path.endsWith('.js')).text;
      const html = readFileSync('src/index.html', 'utf8').replace('<!--APP-->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
      writeFileSync('dist/index.html', html);
      if (argv.lrc) {
        const lrc = JSON.stringify(readFileSync(argv.lrc, 'utf8')).replace(/<\//g, '<\\/');
        const personal = argv.personal || 'out/personal/world.execute(me)_player.html';
        mkdirSync(personal.replace(/[^/]*$/, '') || '.', { recursive: true });
        writeFileSync(personal, html.replace('<!--LYRICS-->', () => `<script>window.__LRC = ${lrc};</script>`).replace('<!--APP-->', ''));
        console.log(`${personal}  (lyrics built in)`);
      }
      // docs/ holds the same file so GitHub Pages (main /docs) can host the player
      if (!serve) { mkdirSync('docs', { recursive: true }); writeFileSync('docs/index.html', html); }
      // dist/artifact.html: the same page without the document skeleton, for hosts that add their own
      const src = readFileSync('src/index.html', 'utf8');
      const pick = re => (src.match(re) || [, ''])[1];
      const bodyInner = pick(/<body>([\s\S]*)<\/body>/).replace('<!--APP-->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
      writeFileSync('dist/artifact.html', `<title>${pick(/<title>([^<]*)<\/title>/)}</title>\n<style>${pick(/<style>([\s\S]*?)<\/style>/)}</style>\n${bodyInner}`);
      console.log(`dist/index.html  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
    });
  },
};

const opts = {
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !serve, sourcemap: false,
  outfile: 'dist/app.js', write: false, target: 'es2020', legalComments: 'none',
  loader: { '.woff2': 'dataurl' }, plugins: [inline], logLevel: 'warning',
};

if (!serve) {
  await esbuild.build(opts);
} else {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(readFileSync('dist/index.html'));
  }).listen(8080, () => console.log('serving http://localhost:8080'));
}
