import Phaser from 'phaser';
import { store } from './core/store';
import { bus } from './core/events';
import { defaultState } from './core/state';
import { readSlot, deleteSlot, latestSlot } from './core/save';
import { pendingRoute } from './phone/phone';
import { audio } from './audio/audio';
import { showMenu, hideMenu } from './ui/menu';
import { showHud } from './ui/hud';
import { showJoystick } from './ui/joystick';
import { fadeOut, fadeIn } from './ui/overlays';
import { toast } from './systems/game';

let game: Phaser.Game;

/** High-level app flow: title → world, and back. */
export const flow = {
  attach(g: Phaser.Game) {
    game = g;
    bus.on('to-title', () => void this.toTitle());
    bus.on('reset-game', () => {
      deleteSlot('auto');
      store.unload();
      void this.toTitle();
    });
    // Save when the app goes to background / tab closes.
    const flush = () => { if (store.hasGame) store.save(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
  },

  async title(scene: Phaser.Scene) {
    showHud(false);
    showJoystick(false);
    audio.playMusic('title');
    audio.setAmbience('outdoor', 'night', false);
    // Opened from a widget / notification / deep link: skip the menu and continue the latest story.
    const latest = pendingRoute() ? latestSlot() : null;
    const res = latest ? { kind: 'load' as const, slot: latest } : await showMenu();
    let intro = false;
    if (res.kind === 'new') {
      store.load(defaultState(res.her, res.him, res.playAs), 'auto');
      store.save('auto');
      intro = true;
    } else {
      const s = readSlot(res.slot);
      if (!s) {
        toast('That save could not be read.', 'key');
        void this.title(scene);
        return;
      }
      store.load(s, res.slot);
    }
    hideMenu();
    await fadeOut('', 500);
    scene.scene.start('World', { location: store.state.location, fromLoad: !intro, intro });
  },

  async toTitle() {
    if (store.hasGame) store.save();
    await fadeOut('', 400);
    store.unload();
    showHud(false);
    showJoystick(false);
    game.scene.stop('World');
    game.scene.start('Title');
    fadeIn();
  },
};
