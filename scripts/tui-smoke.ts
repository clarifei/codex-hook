import assert from 'node:assert/strict';
import { createTestRenderer } from '@opentui/core/testing';
import { type InstallSelection, optionalSkillGroups, workstyles } from './skill-manifest.ts';
import { installMenu } from './tui.ts';

const defaults: InstallSelection = { style: 'caveman', optional: [] };

await installsSelection();
await opensCollectionSubmenu();
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

    view.mockInput.pressKey(' ');
    await view.flush();
    frame = view.captureCharFrame();
    assert.match(frame, /\[x\] Matt Pocock/);
    assert.match(frame, /Optional: Matt Pocock/);

    for (let index = 0; index < optionalSkillGroups.length; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    assert.deepEqual(await within(selection, 'Enter did not install'), {
      style: 'beeline',
      optional: ['matt-pocock'],
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
