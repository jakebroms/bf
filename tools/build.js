// Bundle src/ into one self-contained HTML file.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'src'), out = process.argv[2] || path.join(__dirname, '..', 'BallFive_1977.html');
const read = f => fs.readFileSync(path.join(src, f), 'utf8');
const js = ['data.js', 'sound.js', 'core.js', 'play.js', 'manage.js', 'field.js', 'net.js', 'ui.js', 'extras.js', 'gate.js', 'stats.js'].map(f => '/* ---- ' + f + ' ---- */\n' + read(f).replace(/<\/script/gi, '<\\/script')).join('\n');
let html = read('index.html');
html = html.replace('<!--STYLES-->', () => '<style>\n' + read('styles.css') + '\n</style>');
html = html.replace('<!--SCRIPTS-->', () => '<script>\n' + js + '\n</script>');
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1024 / 1024).toFixed(2), 'MB');
