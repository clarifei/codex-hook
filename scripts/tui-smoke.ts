import assert from 'node:assert/strict';
import { createTestRenderer } from '@opentui/core/testing';
import { type InstallSelection, optionalSkillGroups, workstyles } from './skill-manifest.ts';
import { installMenu } from './tui.ts';

const defaults: InstallSelection = { style: 'caveman', optional: [] };

await installsSelection();
await cancelsFromMenu();
await cancelsWithCtrlC();
process.stdout.write('ok\n');

async function installsSelection() {
  const view = await createTestRenderer({ width: 72, height: 20 });
  try {
    const selection = installMenu(view.renderer, defaults);
    await view.flush();
    assert.match(view.captureCharFrame(), /Step 1 of 2 {2}Choose a workstyle/);
    assert.match(view.captureCharFrame(), /Cancel/);

    const beelineIndex = workstyles.findIndex(({ id }) => id === 'beeline');
    for (let index = 0; index < beelineIndex; index++) view.mockInput.pressArrow('down');
    view.mockInput.pressEnter();
    await view.flush();
    assert.match(view.captureCharFrame(), /Step 2 of 2 {2}Choose optional skill collections/);

    view.mockInput.pressKey(' ');
    await view.flush();
    assert.match(view.captureCharFrame(), /\[x\] Matt Pocock/);
    assert.match(view.captureCharFrame(), /Optional: Matt Pocock/);

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
