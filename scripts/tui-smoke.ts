import assert from 'node:assert/strict';
import { createTestRenderer } from '@opentui/core/testing';
import { type InstallSelection, optionalSkillGroups, workstyles } from './skill-manifest.ts';
import { installMenu } from './tui.ts';

const defaults: InstallSelection = { style: 'caveman', optional: [] };

await installsSelection();
await selectsSingleDenoSkill();
await opensCollectionSubmenu();
await uninstallsInstalledSkill();
await cancelsFromMenu();
await cancelsWithCtrlC();
process.stdout.write('ok\n');

async function installsSelection() {
  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, defaults);
    await view.flush();
    let frame = view.captureCharFrame();
    assert.match(frame, /Step 1 of 2/);
    assert.match(frame, /Choose a workstyle/);
    assert.match(frame, /Terse, direct responses/);
    assert.match(frame, /Cancel/);
    const lines = frame.split('\n');
    assert.equal(
      lines.findIndex((line) => line.includes('Step 1 of 2')),
      lines.findIndex((line) => line.includes('codex-hook setup')) + 1,
    );

    const beelineIndex = workstyles.findIndex(({ id }) => id === 'beeline');
    for (let index = 0; index < beelineIndex; index++) view.mockInput.pressArrow('down');
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /Structured, action-first responses/);
    view.mockInput.pressEnter();
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /Step 2 of 2/);
    assert.match(frame, /Optional skill collections/);
    assert.match(frame, /Engineering and productivity workflows/);

    view.mockInput.pressEnter();
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /Matt Pocock skills/);
    assert.match(frame, /Engineering/);
    assert.match(frame, /Productivity/);
    view.mockInput.pressKey(' ');
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /\[x\] Engineering/);
    const mattSkills = optionalSkillGroups.find(({ id }) => id === 'matt-pocock')!.skills;
    for (let index = 0; index < mattSkills.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    assert.match(view.captureCharFrame(), /Optional: Matt Pocock 1\/2/);

    for (let index = 0; index < optionalSkillGroups.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    assert.deepEqual(await within(selection, 'Enter did not install'), {
      style: 'beeline',
      optional: ['matt-pocock-engineering'],
    });
  } finally {
    view.renderer.destroy();
  }
}

async function cancelsFromMenu() {
  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, defaults);
    for (let index = 0; index < workstyles.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    assert.equal(await within(selection, 'Cancel option did not cancel'), null);
  } finally {
    view.renderer.destroy();
  }
}

async function selectsSingleDenoSkill() {
  const partialView = await createTestRenderer({ width: 72, height: 20 });
  try {
    const partialSelection = installMenu(partialView.renderer, {
      ...defaults,
      optional: ['deno'],
      installed: ['deno'],
    });
    partialView.mockInput.pressEnter();
    await partialView.flush();
    assert.match(partialView.captureCharFrame(), /\[-\] Deno\s+partial/);
    partialView.mockInput.pressCtrlC();
    assert.equal(await within(partialSelection, 'Partial Deno selection did not cancel'), null);
  } finally {
    partialView.renderer.destroy();
  }

  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, defaults);
    view.mockInput.pressEnter();
    await view.flush();
    const denoIndex = optionalSkillGroups.findIndex(({ id }) => id === 'deno');
    for (let index = 0; index < denoIndex; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    view.mockInput.pressKey(' ');
    await view.flush();
    const denoSkills = optionalSkillGroups.find(({ id }) => id === 'deno')!.skills;
    for (let index = 0; index < denoSkills.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    for (let index = 0; index < optionalSkillGroups.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    assert.deepEqual(await within(selection, 'Single Deno skill did not install'), {
      style: 'caveman',
      optional: ['deno'],
    });
  } finally {
    view.renderer.destroy();
  }
}

async function uninstallsInstalledSkill() {
  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, {
      ...defaults,
      optional: ['tanstack-query'],
      installed: ['tanstack-query'],
    });
    view.mockInput.pressEnter();
    await view.flush();
    assert.match(view.captureCharFrame(), /\[-\] TanStack\s+partial/);
    const tanstackIndex = optionalSkillGroups.findIndex(({ id }) => id === 'tanstack');
    for (let index = 0; index < tanstackIndex; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    const queryIndex = optionalSkillGroups.find(({ id }) => id === 'tanstack')!.skills.findIndex(({ id }) =>
      id === 'tanstack-query'
    );
    for (let index = 0; index < queryIndex; index++) view.mockInput.pressArrow('down');
    await view.flush();
    assert.match(view.captureCharFrame(), /\[x\] TanStack Query\s+ok/);
    view.mockInput.pressKey(' ');
    await view.flush();
    assert.match(view.captureCharFrame(), /\[ \] TanStack Query\s+ok/);
    const tanstackSkills = optionalSkillGroups.find(({ id }) => id === 'tanstack')!.skills;
    for (let index = queryIndex; index < tanstackSkills.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    for (let index = 0; index < optionalSkillGroups.length + 1; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    assert.match(view.captureCharFrame(), /Uninstall installed skills/);
    view.mockInput.pressKey(' ');
    await view.flush();
    view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    assert.deepEqual(await within(selection, 'Uninstall did not finish'), {
      style: 'caveman',
      optional: [],
      uninstall: ['tanstack-query'],
    });
  } finally {
    view.renderer.destroy();
  }
}

async function opensCollectionSubmenu() {
  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, defaults);
    view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    const tanstackIndex = optionalSkillGroups.findIndex(({ id }) => id === 'tanstack');
    for (let index = 0; index < tanstackIndex; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    let frame = view.captureCharFrame();
    assert.match(frame, /TanStack skills/);
    assert.match(frame, /TanStack AI/);
    view.mockInput.pressKey(' ');
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /\[x\] TanStack AI/);
    for (let index = 0; index < optionalSkillGroups.find(({ id }) => id === 'tanstack')!.skills.length; index++) {
      view.mockInput.pressArrow('down');
    }
    await view.flush();
    assert.match(view.captureCharFrame(), /Back/);
    view.mockInput.pressEnter();
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /Optional skill collections/);
    assert.match(frame, /Optional: TanStack 1\/14/);
    view.mockInput.pressCtrlC();
    assert.equal(await within(selection, 'Ctrl-C did not cancel submenu'), null);
  } finally {
    view.renderer.destroy();
  }
}

async function cancelsWithCtrlC() {
  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, defaults);
    view.mockInput.pressCtrlC();
    assert.equal(await within(selection, 'Ctrl-C did not cancel'), null);
  } finally {
    view.renderer.destroy();
  }
}

function within<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), 250)),
  ]);
}
