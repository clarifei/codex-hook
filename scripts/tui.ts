import { writeFile } from 'node:fs/promises';
import {
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  RGBA,
  type SelectOption,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
} from '@opentui/core';
import { coreComponents, type InstallSelection, optionalSkillGroups, workstyles } from './skill-manifest.ts';

const runtimeArgs = process.argv.slice(2);
const INSTALL = Symbol('install');

async function chooseInstall(
  defaults: InstallSelection = { style: 'caveman', optional: [] },
): Promise<InstallSelection | null> {
  const renderer = await createCliRenderer({
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    useMouse: false,
  });
  return installMenu(renderer, defaults);
}

function installMenu(
  renderer: CliRenderer,
  defaults: InstallSelection,
): Promise<InstallSelection | null> {
  const selected = new Set(defaults.optional);
  let style = defaults.style;
  let stage: 'style' | 'optional' = 'style';
  let finished = false;
  const foreground = RGBA.defaultForeground();
  const background = RGBA.defaultBackground();
  const menuRows = Math.max(workstyles.length, optionalSkillGroups.length + 1) * 2;

  const title = new TextRenderable(renderer, {
    content: 'codex-hook',
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const subtitle = new TextRenderable(renderer, {
    content: '1 / 2  Workstyle',
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const menu = new SelectRenderable(renderer, {
    width: '100%',
    height: Math.max(2, Math.min(menuRows, renderer.height - 8)),
    options: workstyleOptions(),
    selectedIndex: Math.max(0, workstyles.findIndex(({ id }) => id === style)),
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
    keyBindings: [{ name: 'space', action: 'select-current' }],
  });
  const core = new TextRenderable(renderer, {
    content: `Always: ${coreComponents.map(({ label }) => label).join(' | ')}`,
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const layout = new BoxRenderable(renderer, {
    width: '100%',
    height: '100%',
    padding: 1,
    flexDirection: 'column',
    gap: 1,
  });
  for (const child of [title, subtitle, menu, core]) layout.add(child);

  return new Promise((resolve) => {
    const finish = (selection: InstallSelection | null) => {
      if (finished) return;
      finished = true;
      renderer.destroy();
      resolve(selection);
    };

    const showStyle = () => {
      stage = 'style';
      subtitle.content = '1 / 2  Workstyle';
      menu.options = workstyleOptions();
      menu.setSelectedIndex(Math.max(0, workstyles.findIndex(({ id }) => id === style)));
    };

    const showOptional = () => {
      stage = 'optional';
      subtitle.content = '2 / 2  Optional skills';
      menu.options = optionalOptions(selected);
      menu.setSelectedIndex(0);
    };

    menu.on(SelectRenderableEvents.ITEM_SELECTED, (index: number, option: SelectOption) => {
      if (stage === 'style') {
        const workstyle = workstyles.find(({ id }) => id === option.value);
        if (!workstyle) return;
        style = workstyle.id;
        showOptional();
        return;
      }
      if (option.value === INSTALL) {
        finish({ style, optional: [...selected].sort() });
        return;
      }
      const group = optionalSkillGroups.find(({ id }) => id === option.value);
      if (!group) return;
      toggle(selected, group.id);
      menu.options = optionalOptions(selected);
      menu.setSelectedIndex(index);
    });

    renderer.prependInputHandler((sequence) => {
      if (sequence === '\x03') {
        finish(null);
        return true;
      }
      if (sequence !== '\x1b') return false;
      if (stage === 'optional') showStyle();
      else finish(null);
      return true;
    });

    renderer.root.add(layout);
    menu.focus();
  });
}

function workstyleOptions(): SelectOption[] {
  return workstyles.map(({ id, label, description }) => ({
    name: label,
    description,
    value: id,
  }));
}

function optionalOptions(selected: Set<string>): SelectOption[] {
  return [
    ...optionalSkillGroups.map(({ id, label, description }) => ({
      name: `[${selected.has(id) ? 'x' : ' '}] ${label}`,
      description,
      value: id,
    })),
    {
      name: 'Install',
      description: 'Apply this selection',
      value: INSTALL,
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
  const { createTestRenderer } = await import('@opentui/core/testing');
  const view = await createTestRenderer({ width: 60, height: 16 });
  try {
    const selection = installMenu(view.renderer, { style: 'caveman', optional: [] });
    await view.flush();
    if (!view.captureCharFrame().includes('1 / 2  Workstyle')) throw new Error('workstyle step did not render');

    view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    if (!view.captureCharFrame().includes('2 / 2  Optional skills')) throw new Error('optional step did not open');

    view.mockInput.pressKey(' ');
    await view.flush();
    if (!view.captureCharFrame().includes('[x] Matt Pocock')) throw new Error('space did not toggle a skill');

    view.mockInput.pressArrow('down');
    view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    const result = await Promise.race([
      selection,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('enter did not install')), 250)),
    ]);
    if (result?.style !== 'beeline' || result.optional[0] !== 'matt-pocock') {
      throw new Error('keyboard selection returned the wrong result');
    }
  } finally {
    view.renderer.destroy();
  }
  process.stdout.write('ok\n');
}
