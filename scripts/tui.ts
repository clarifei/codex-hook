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
const CANCEL = Symbol('cancel');
const cancelOption: SelectOption = {
  name: 'Cancel',
  description: 'Leave the current installation unchanged',
  value: CANCEL,
};

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
  const maxOptions = Math.max(workstyles.length + 1, optionalSkillGroups.length + 2);
  const menuHeight = Math.max(2, Math.min(maxOptions, renderer.height - 15));

  const title = new TextRenderable(renderer, {
    content: 'codex-hook setup',
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const subtitle = new TextRenderable(renderer, {
    content: 'Step 1 of 2',
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const menu = new SelectRenderable(renderer, {
    width: '100%',
    height: menuHeight,
    options: workstyleOptions(),
    selectedIndex: Math.max(0, workstyles.findIndex(({ id }) => id === style)),
    backgroundColor: 'transparent',
    focusedBackgroundColor: 'transparent',
    textColor: foreground,
    focusedTextColor: foreground,
    selectedBackgroundColor: foreground,
    selectedTextColor: background,
    showScrollIndicator: true,
    showDescription: false,
    wrapSelection: true,
  });
  const detail = new TextRenderable(renderer, {
    content: '',
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const panel = new BoxRenderable(renderer, {
    width: '100%',
    height: menuHeight + 5,
    padding: 1,
    flexDirection: 'column',
    gap: 1,
    border: true,
    borderStyle: 'single',
    borderColor: foreground,
    backgroundColor: background,
    title: 'Choose a workstyle',
    titleColor: foreground,
  });
  panel.add(menu);
  panel.add(detail);
  const summary = new TextRenderable(renderer, {
    content: selectionSummary(style, selected),
    height: 1,
    fg: foreground,
    bg: background,
    truncate: true,
  });
  const core = new TextRenderable(renderer, {
    content: `Included: ${coreComponents.map(({ label }) => label).join(' | ')}`,
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
    overflow: 'hidden',
    backgroundColor: background,
  });
  for (const child of [title, subtitle, panel, summary, core]) layout.add(child);

  return new Promise((resolve) => {
    const finish = (selection: InstallSelection | null) => {
      if (finished) return;
      finished = true;
      renderer.destroy();
      resolve(selection);
    };

    const showStyle = () => {
      stage = 'style';
      subtitle.content = 'Step 1 of 2';
      panel.title = 'Choose a workstyle';
      summary.content = selectionSummary(style, selected);
      menu.options = workstyleOptions();
      menu.setSelectedIndex(Math.max(0, workstyles.findIndex(({ id }) => id === style)));
    };

    const showOptional = () => {
      stage = 'optional';
      subtitle.content = 'Step 2 of 2';
      panel.title = 'Optional skill collections';
      summary.content = selectionSummary(style, selected);
      menu.options = optionalOptions(selected);
      menu.setSelectedIndex(0);
    };

    const toggleOptional = (index: number, option: SelectOption | null) => {
      const group = optionalSkillGroups.find(({ id }) => id === option?.value);
      if (!group) return;
      toggle(selected, group.id);
      summary.content = selectionSummary(style, selected);
      menu.options = optionalOptions(selected);
      menu.setSelectedIndex(index);
    };

    menu.on(SelectRenderableEvents.SELECTION_CHANGED, (_index: number, option: SelectOption | null) => {
      detail.content = option?.description ?? '';
    });
    menu.on(SelectRenderableEvents.ITEM_SELECTED, (index: number, option: SelectOption) => {
      if (option.value === CANCEL) {
        finish(null);
        return;
      }
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
      toggleOptional(index, option);
    });

    renderer.prependInputHandler((sequence) => {
      if (sequence === '\x03') {
        finish(null);
        return true;
      }
      if (sequence === ' ') {
        if (stage === 'optional') toggleOptional(menu.getSelectedIndex(), menu.getSelectedOption());
        return true;
      }
      if (sequence !== '\x1b') return false;
      if (stage === 'optional') showStyle();
      else finish(null);
      return true;
    });

    detail.content = menu.getSelectedOption()?.description ?? '';
    renderer.root.add(layout);
    menu.focus();
  });
}

function workstyleOptions(): SelectOption[] {
  return [
    ...workstyles.map(({ id, label, description }) => ({
      name: label,
      description,
      value: id,
    })),
    cancelOption,
  ];
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
    cancelOption,
  ];
}

function selectionSummary(style: InstallSelection['style'], selected: Set<string>) {
  const label = workstyles.find(({ id }) => id === style)?.label ?? style;
  const optional = optionalSkillGroups.filter(({ id }) => selected.has(id)).map(({ label }) => label).join(', ') ||
    'none';
  return `Selected: ${label} | Optional: ${optional}`;
}

function toggle(selected: Set<string>, id: string) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
}

if (import.meta.main) {
  const selection = await chooseInstall(readDefaults());
  const output = argument('--output');
  if (output) await writeFile(output, JSON.stringify(selection), 'utf8');
  else console.log(JSON.stringify(selection));
}

function argument(name: string) {
  const index = runtimeArgs.indexOf(name);
  return index < 0 ? undefined : runtimeArgs[index + 1];
}

function readDefaults(): InstallSelection {
  const value = argument('--defaults');
  return value ? JSON.parse(value) : { style: 'caveman', optional: [] };
}

export { installMenu };
