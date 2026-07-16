// One-off migration script: merges the embedded cortex-debug core's manifest
// contributions into the host VS Arduino package.json.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE_PREFIX = 'src/debugger/cortex-debug-core/';

const host = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const core = JSON.parse(fs.readFileSync(path.join(ROOT, CORE_PREFIX, 'package.json'), 'utf8'));

const prefixPath = (p) =>
  typeof p === 'string'
    ? p.replace(/^\.\//, CORE_PREFIX).replace(/^(?=images\/|syntaxes\/|dist\/|resources\/|support\/)/, CORE_PREFIX)
    : p;
const fixWhen = (w) =>
  typeof w === 'string' ? w.replace(/debugType == cortex-debug\b/g, 'debugType == vs-arduino-cortex-debug') : w;

const coreDebugger = core.contributes.debuggers[0];
coreDebugger.program = CORE_PREFIX + 'dist/debugadapter.js';
host.contributes.debuggers = host.contributes.debuggers.filter((d) => d.type !== coreDebugger.type);
host.contributes.debuggers.push(coreDebugger);

const existingCommands = new Set(host.contributes.commands.map((c) => c.command));
host.contributes.commands.push(
  ...core.contributes.commands
    .filter((c) => !existingCommands.has(c.command))
    .map((c) => {
      if (c.icon && typeof c.icon === 'object') {
        for (const k of Object.keys(c.icon)) c.icon[k] = prefixPath(c.icon[k]);
      } else if (typeof c.icon === 'string' && !c.icon.startsWith('$(')) {
        c.icon = prefixPath(c.icon);
      }
      return c;
    }),
);

host.contributes.keybindings = (core.contributes.keybindings || []).map((k) => ({ ...k, when: fixWhen(k.when) }));
host.contributes.languages = core.contributes.languages;
host.contributes.grammars = core.contributes.grammars.map((g) => ({ ...g, path: prefixPath(g.path) }));
host.contributes.breakpoints = core.contributes.breakpoints;

host.contributes.viewsContainers.panel = [
  ...(host.contributes.viewsContainers.panel || []),
  ...(core.contributes.viewsContainers.panel || []).map((v) => ({ ...v, icon: prefixPath(v.icon) })),
];

for (const [container, views] of Object.entries(core.contributes.views)) {
  const mapped = views.map((v) => ({ ...v, when: fixWhen(v.when), icon: v.icon ? prefixPath(v.icon) : v.icon }));
  host.contributes.views[container] = [...(host.contributes.views[container] || []), ...mapped];
}

for (const [menu, items] of Object.entries(core.contributes.menus)) {
  const mapped = items.map((i) => ({ ...i, when: fixWhen(i.when) }));
  host.contributes.menus[menu] = [...(host.contributes.menus[menu] || []), ...mapped];
}

if (Array.isArray(host.contributes.configuration)) {
  host.contributes.configuration = [host.contributes.configuration[0], core.contributes.configuration];
} else {
  host.contributes.configuration = [host.contributes.configuration, core.contributes.configuration];
}

host.activationEvents = ['onDebugResolve:arduino', 'onDebugResolve:vs-arduino-cortex-debug', 'onStartupFinished'];

fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(host, null, 2) + '\n');
console.log('merged. debuggers:', host.contributes.debuggers.map((d) => d.type).join(', '));
console.log('commands:', host.contributes.commands.length, '| views keys:', Object.keys(host.contributes.views).join(', '));
