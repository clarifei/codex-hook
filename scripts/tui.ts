import { writeFile } from 'node:fs/promises';
import type { SelectRenderable } from '@opentui/core';
import { type InstallSelection, optionalSkillGroups } from './skill-manifest.ts';

const runtimeArgs = process.argv.slice(2);

async function chooseInstall(
  defaults: InstallSelection = { style: 'caveman', optional: [] },
): Promise<InstallSelection | null> {
  const { Box, RGBA, Select, SelectRenderableEvents, Text, createCliRenderer } = await import('@opentui/core');
  const renderer = await createCliRenderer({
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    useMouse: false,
  });
  const selected = new Set(defaults.optional);
  let style = defaults.style;
  let finished = false;
  const installIndex = 2 + optionalSkillGroups.length;
  const foreground = RGBA.defaultForeground();
  const background = RGBA.defaultBackground();

  const title = Text({ content: 'codex-hook installer', height: 1 });
  const subtitle = Text({
    content: 'Workstyle and optional skills',
    height: 1,
  });
  const menu = Select({
    width: '100%',
    height: Math.max(8, Math.min(16, renderer.height - 8)),
    options: menuOptions(style, selected),
    selectedIndex: style === 'caveman' ? 0 : 1,
    backgroundColor: 'transparent',
    focusedBackgroundColor: 'transparent',
    textColor: foreground,
    focusedTextColor: foreground,
    selectedBackgroundColor: foreground,
    selectedTextColor: background,
    descriptionColor: foreground,
    selectedDescriptionColor: background,
    showScrollIndicator: true,
    wrapSelection: true,
  }) as unknown as SelectRenderable;
  const core = Text({
    content: 'Core: Ponytail | RTK | Codebase Memory MCP | Wigolo',
    height: 1,
  });

  renderer.root.add(Box(
    {
      width: '100%',
      height: '100%',
      padding: 2,
      flexDirection: 'column',
      gap: 1,
    },
    title,
    subtitle,
    menu,
    core,
  ));
  menu.focus();

  return await new Promise((resolve) => {
    const finish = (selection: InstallSelection | null) => {
      if (finished) return;
      finished = true;
      renderer.destroy();
      resolve(selection);
    };

    const select = (index: number) => {
      if (index < 2) style = index === 0 ? 'caveman' : 'beeline';
      else if (index < installIndex) {
        toggle(selected, optionalSkillGroups[index - 2].id);
      } else {
        finish(
          index === installIndex ? { style, optional: [...selected].sort() } : null,
        );
        return;
      }
      menu.options = menuOptions(style, selected);
      menu.setSelectedIndex(index);
    };

    menu.on(SelectRenderableEvents.ITEM_SELECTED, select);

    renderer.prependInputHandler((sequence) => {
      if (sequence === '\x03' || sequence === '\x1b') {
        finish(null);
        return true;
      }
      if (sequence !== ' ') return false;
      const index = menu.getSelectedIndex();
      if (index >= installIndex) return false;
      select(index);
      return true;
    });
  });
}

function menuOptions(style: InstallSelection['style'], selected: Set<string>) {
  return [
    {
      name: `(${style === 'caveman' ? 'x' : ' '}) Caveman`,
      description: 'Baseline: terse, direct responses',
      value: 'caveman',
    },
    {
      name: `(${style === 'beeline' ? 'x' : ' '}) Beeline`,
      description: 'Structured, action-first responses',
      value: 'beeline',
    },
    ...optionalSkillGroups.map((group) => ({
      name: `[${selected.has(group.id) ? 'x' : ' '}] ${group.label}`,
      description: group.description,
      value: group.id,
    })),
    {
      name: 'Install selected',
      description: 'Apply the baseline and selected collections',
      value: 'install',
    },
    {
      name: 'Cancel',
      description: 'Leave the current installation unchanged',
      value: 'cancel',
    },
  ];
}

function toggle(selected: Set<string>, id: string) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
}

if (import.meta.main) {
  if (runtimeArgs.includes('--smoke-test')) {
    await smokeTest();
  } else {
    const selection = await chooseInstall(readDefaults());
    const output = argument('--output');
    if (output) await writeFile(output, JSON.stringify(selection), 'utf8');
    else console.log(JSON.stringify(selection));
  }
}

function argument(name: string) {
  const index = runtimeArgs.indexOf(name);
  return index < 0 ? undefined : runtimeArgs[index + 1];
}

function readDefaults(): InstallSelection {
  const value = argument('--defaults');
  return value ? JSON.parse(value) : { style: 'caveman', optional: [] };
}

async function smokeTest() {
  const { Text } = await import('@opentui/core');
  const { createTestRenderer } = await import('@opentui/core/testing');
  const view = await createTestRenderer({ width: 40, height: 10 });
  try {
    view.renderer.root.add(Text({ content: 'OpenTUI smoke test' }));
    await view.flush();
    if (!view.captureCharFrame().includes('OpenTUI smoke test')) {
      throw new Error('OpenTUI rendered an empty frame');
    }
  } finally {
    view.renderer.destroy();
  }
  process.stdout.write('ok\n');
}
