import Phaser from 'phaser';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import './styles/main.css';

import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { flow } from './flow';
import { store } from './core/store';
import { audio } from './audio/audio';
import { cloud } from './backend/cloud';
import { initToasts } from './ui/toast';
import { initDialogue } from './ui/dialogue';
import { initPanels } from './ui/panels';
import { initHud } from './ui/hud';
import { initJoystick } from './ui/joystick';
import { initOverlays } from './ui/overlays';
import { initMenu } from './ui/menu';
import { initFx } from './ui/fx';
import { initPhone } from './phone/phone';
import { initBanner } from './phone/banner';
import { startScheduler } from './phone/scheduler/scheduler';
import { initPizza } from './pizza/unlock';
import { initGarden } from './garden/unlock';
import { initWork } from './work/work';
import { initPets } from './pets/pets';
import { initDev } from './dev';
import './phone/apps';
import { HER_PORTRAITS, HIS_PORTRAITS } from './content/characters';

async function boot() {
  // Fonts must be ready before we paint text into canvases.
  await Promise.race([
    Promise.all(['600 20px Fredoka', '400 20px Fredoka', '40px Caveat', 'italic 600 40px "Cormorant Garamond"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  // Warm the browser cache with her portraits so dialogue never shows a blank frame.
  const art = [...Object.values(HER_PORTRAITS), ...Object.values(HIS_PORTRAITS)];
  for (const src of new Set([...art, ...art.map((s) => s!.replace('.webp', '-avatar.webp'))])) {
    if (src) new Image().src = src;
  }

  initFx();
  initOverlays();
  initMenu();
  initHud();
  initJoystick();
  initDialogue();
  initPanels();
  initToasts();
  initPhone();
  initBanner();
  startScheduler();
  initPizza();
  initGarden();
  initWork();
  initPets();
  initDev();
  audio.setVolumes(store.settings);
  void cloud.init();

  // Unlock audio on first interaction anywhere (mobile requirement).
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1d1527',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, WorldScene],
    fps: { target: 60 },
  });
  flow.attach(game);
  (window as any).__evermore = { game, store };
  document.getElementById('loading')?.remove();
}

void boot();
