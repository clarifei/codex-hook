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
import {
  coreComponents,
  type InstallSelection,
  normalizeOptional,
  type OptionalSkillGroup,
  optionalSkillGroups,
  optionalSkills,
  workstyles,
} from './skill-manifest.ts';

const runtimeArgs = process.argv.slice(2);
const INSTALL = Symbol('install');
const UNINSTALL = Symbol('uninstall');
const CANCEL = Symbol('cancel');
const BACK = Symbol('back');
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
  const selected = new Set(normalizeOptional(defaults.optional, false));
  let style = defaults.style;
  let stage: 'style' | 'groups' | 'skills' | 'uninstall' = 'style';
  let activeGroup: OptionalSkillGroup | null = null;
  const installed = new Set(defaults.installed ?? []);
  const uninstallSelected = new Set<string>();
  for (const id of installed) selected.add(id);
  let finished = false;
  const foreground = RGBA.defaultForeground();
  const background = RGBA.defaultBackground();
  const accent = RGBA.fromIndex(6);
  const headingColor = RGBA.fromIndex(3);
  const muted = RGBA.fromIndex(8);
  const positive = RGBA.fromIndex(2);
  const selectedText = RGBA.fromIndex(15);
  const selectedBackground = RGBA.fromIndex(4);
  const menuHeight = Math.max(2, renderer.height - 10);

  const title = new TextRenderable(renderer, {
    content: 'codex-hook setup',
    height: 1,
    fg: accent,
    bg: background,
    truncate: true,
  });
  const subtitle = new TextRenderable(renderer, {
    content: 'Step 1 of 2',
    height: 1,
    fg: muted,
    bg: background,
    truncate: true,
  });
  const menu = new SelectRenderable(renderer, {
    width: '100%',
    height: Math.min(workstyleOptions().length, menuHeight),
    options: workstyleOptions(),
    selectedIndex: Math.max(0, workstyles.findIndex(({ id }) => id === style)),
    backgroundColor: 'transparent',
    focusedBackgroundColor: 'transparent',
    textColor: foreground,
    focusedTextColor: foreground,
    selectedBackgroundColor: selectedBackground,
    selectedTextColor: selectedText,
    descriptionColor: muted,
    selectedDescriptionColor: selectedText,
    showScrollIndicator: true,
    showDescription: false,
    wrapSelection: true,
  });
  const detail = new TextRenderable(renderer, {
    content: '',
    height: 1,
    fg: muted,
    bg: background,
    truncate: true,
  });
  const heading = new TextRenderable(renderer, {
    content: 'Choose a workstyle',
    height: 1,
    fg: headingColor,
    bg: background,
    truncate: true,
  });
  const divider = new TextRenderable(renderer, {
    content: '---',
    height: 1,
    fg: muted,
    bg: background,
    truncate: true,
  });
  const summary = new TextRenderable(renderer, {
    content: selectionSummary(style, selected),
    height: 1,
    fg: positive,
    bg: background,
    truncate: true,
  });
  const core = new TextRenderable(renderer, {
    content: `Included: ${coreComponents.map(({ label }) => label).join(' | ')}`,
    height: 1,
    fg: muted,
    bg: background,
    truncate: true,
  });
  const layout = new BoxRenderable(renderer, {
    width: '100%',
    height: '100%',
    padding: 1,
    flexDirection: 'column',
    gap: 0,
    overflow: 'hidden',
    backgroundColor: background,
  });
  for (const child of [title, subtitle, heading, divider, menu, detail, summary, core]) layout.add(child);

  return new Promise((resolve) => {
    const setMenu = (options: SelectOption[], selectedIndex: number) => {
      menu.height = Math.min(options.length, menuHeight);
      menu.options = options;
      menu.setSelectedIndex(selectedIndex);
      detail.content = menu.getSelectedOption()?.description ?? '';
    };

    const finish = (selection: InstallSelection | null) => {
      if (finished) return;
      finished = true;
      renderer.destroy();
      resolve(selection);
    };

    const showStyle = () => {
      stage = 'style';
      activeGroup = null;
      subtitle.content = 'Step 1 of 2';
      heading.content = 'Choose a workstyle';
      summary.content = selectionSummary(style, selected);
      setMenu(workstyleOptions(), Math.max(0, workstyles.findIndex(({ id }) => id === style)));
    };

    const showOptional = () => {
      stage = 'groups';
      activeGroup = null;
      subtitle.content = 'Step 2 of 2';
      heading.content = 'Optional skill collections';
      summary.content = selectionSummary(style, selected);
      setMenu(optionalOptions(selected, installed), 0);
    };

    const showSkills = (group: OptionalSkillGroup) => {
      stage = 'skills';
      activeGroup = group;
      subtitle.content = 'Step 2 of 2';
      heading.content = `${group.label} skills`;
      setMenu(skillOptions(group, selected, installed), 0);
    };

    const showUninstall = () => {
      stage = 'uninstall';
      activeGroup = null;
      subtitle.content = 'Installed skills';
      heading.content = 'Uninstall installed skills';
      summary.content = `${uninstallSelected.size} marked for removal`;
      setMenu(uninstallOptions(installed, uninstallSelected), 0);
    };

    const toggleOptional = (index: number, option: SelectOption | null) => {
      if (stage === 'groups') {
        const group = optionalSkillGroups.find(({ id }) => id === option?.value);
        if (!group) return;
        if (group.skills.length > 1) {
          showSkills(group);
          return;
        }
        toggle(selected, group.skills[0].id);
        summary.content = selectionSummary(style, selected);
        setMenu(optionalOptions(selected, installed), index);
        return;
      }
      if (stage === 'uninstall') {
        if (typeof option?.value !== 'string' || !installed.has(option.value)) return;
        toggle(uninstallSelected, option.value);
        summary.content = `${uninstallSelected.size} marked for removal`;
        setMenu(uninstallOptions(installed, uninstallSelected), index);
        return;
      }
      if (stage !== 'skills' || !activeGroup) return;
      const skill = activeGroup.skills.find(({ id }) => id === option?.value);
      if (!skill) return;
      toggle(selected, skill.id);
      summary.content = selectionSummary(style, selected);
      setMenu(skillOptions(activeGroup, selected, installed), index);
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
      if (option.value === BACK) {
        showOptional();
        return;
      }
      if (option.value === INSTALL) {
        finish({ style, optional: [...selected].sort() });
        return;
      }
      if (option.value === UNINSTALL) {
        if (stage === 'uninstall') {
          if (uninstallSelected.size) {
            finish({
              style,
              optional: [...selected].sort(),
              uninstall: [...uninstallSelected].sort(),
            });
          }
        } else if (installed.size) showUninstall();
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
        if (stage !== 'style') toggleOptional(menu.getSelectedIndex(), menu.getSelectedOption());
        return true;
      }
      if (sequence !== '\x1b') return false;
      if (stage === 'skills' || stage === 'uninstall') showOptional();
      else if (stage === 'groups') showStyle();
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

function optionalOptions(selected: Set<string>, installed: Set<string>): SelectOption[] {
  return [
    ...optionalSkillGroups.map((group) => ({
      name: `[${groupMark(group, selected)}] ${group.label}${groupStatus(group, installed)}`,
      description: group.description,
      value: group.id,
    })),
    {
      name: 'Install',
      description: 'Apply this selection',
      value: INSTALL,
    },
    ...(installed.size
      ? [{
        name: 'Uninstall installed skills',
        description: 'Remove selected local skills without touching edited files',
        value: UNINSTALL,
      }]
      : []),
    cancelOption,
  ];
}

function skillOptions(group: OptionalSkillGroup, selected: Set<string>, installed: Set<string>): SelectOption[] {
  return [
    ...group.skills.map(({ id, label, description }) => ({
      name: `[${selected.has(id) ? 'x' : ' '}] ${label}${installed.has(id) ? '  ok' : ''}`,
      description,
      value: id,
    })),
    {
      name: 'Back',
      description: 'Return to optional skill collections',
      value: BACK,
    },
  ];
}

function uninstallOptions(installed: Set<string>, selected: Set<string>): SelectOption[] {
  return [
    ...optionalSkills
      .filter(({ id }) => installed.has(id))
      .map(({ id, label, description }) => ({
        name: `[${selected.has(id) ? 'x' : ' '}] ${label}`,
        description,
        value: id,
      })),
    {
      name: 'Uninstall',
      description: 'Remove marked skills and preserve user edits',
      value: UNINSTALL,
    },
    {
      name: 'Back',
      description: 'Return to optional skill collections',
      value: BACK,
    },
  ];
}

function selectionSummary(style: InstallSelection['style'], selected: Set<string>) {
  const label = workstyles.find(({ id }) => id === style)?.label ?? style;
  const optional = optionalSkillGroups.flatMap((group) => {
    const count = group.skills.filter(({ id }) => selected.has(id)).length;
    if (!count) return [];
    return group.skills.length === 1 ? [group.label] : [`${group.label} ${count}/${group.skills.length}`];
  }).join(', ') || 'none';
  return `Selected: ${label} | Optional: ${optional}`;
}

function groupMark(group: OptionalSkillGroup, selected: Set<string>) {
  const count = group.skills.filter(({ id }) => selected.has(id)).length;
  return count === group.skills.length ? 'x' : count ? '-' : ' ';
}

function groupStatus(group: OptionalSkillGroup, installed: Set<string>) {
  const count = group.skills.filter(({ id }) => installed.has(id)).length;
  return count === group.skills.length ? '  ok' : count ? '  partial' : '';
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
