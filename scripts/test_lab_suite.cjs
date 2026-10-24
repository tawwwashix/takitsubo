// One entry point; no package installation or modification of the user's browser.
// NODE_PATH must expose Playwright. Start start-episode-lab.bat first.
const {spawnSync} = require('node:child_process');
const path = require('node:path'), fs = require('node:fs');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.local-preview');
const base = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:8766';
fs.mkdirSync(out, {recursive:true});
const files = fs.readdirSync(__dirname).filter(f => /^test_lab_.*\.cjs$/.test(f) && f !== 'test_lab_suite.cjs');
files.push('test_share_regression.cjs', 'test_share_failures.cjs', 'test_shindan_module.cjs');
if(process.argv.includes('--site')) files.push('test_site_lab_integration.cjs', 'test_episode_cards.cjs', 'test_navigation.cjs', 'test_episode_lab.cjs', 'test_analytics.cjs');
const results = [];
for(const file of files) {
  console.log('RUN', file);
  const start = Date.now();
  const run = spawnSync(process.execPath, [path.join(__dirname,file), base], {
    cwd:root, encoding:'utf8', timeout:300000,
    env:{...process.env, TK_TEST_OUTPUT:path.join(out,file.replace('.cjs',''))}
  });
  const output = (run.stdout || '') + (run.stderr || '') + (run.error ? '\n' + run.error.message : '');
  fs.writeFileSync(path.join(out, file + '.log'), output);
  const passed = run.status === 0;
  results.push({file, passed, seconds:Math.round((Date.now()-start)/1000)});
  console.log(passed ? 'PASS' : 'FAIL', file);
  if(!passed) console.log(output.slice(-3000));
  fs.writeFileSync(path.join(out,'suite-report.json'), JSON.stringify(results,null,2));
}
console.log(`${results.filter(r => r.passed).length}/${results.length} passed. Logs: ${out}`);
process.exitCode = results.every(r => r.passed) ? 0 : 1;
