import Phaser from 'phaser';
import { ROOMS } from '../art/rooms';
import { makeCanvas, drawStringLights } from '../art/paint';
import { flow } from '../flow';

/** Animated night-sky backdrop behind the DOM title menu. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const W = 1600;
    const sky = this.textureOnce('title-sky', 1280, 720, (ctx) => ROOMS.backyard.sky!(ctx, 'night'));
    const far = this.textureOnce('title-far', W, 720, (ctx) => ROOMS.backyard.far!(ctx, 'night', W));
    const lights = this.textureOnce('title-lights', W, 200, (ctx) => drawStringLights(ctx, 0, W, 40, 30, true, 'title'));
    this.add.image(0, 0, sky).setOrigin(0).setScrollFactor(0);
    const farImg = this.add.image(0, 60, far).setOrigin(0);
    const lightImg = this.add.image(0, 0, lights).setOrigin(0);
    // gentle ground glow
    this.add.rectangle(0, 600, W, 120, 0x1a2244, 0.9).setOrigin(0);

    this.add.particles(0, 0, 'p-petal', {
      x: { min: 0, max: 1280 }, y: -20, lifespan: 9000, speedY: { min: 30, max: 60 }, speedX: { min: -30, max: 20 },
      rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1.2 }, alpha: { start: 0.9, end: 0.3 }, frequency: 350,
    }).setScrollFactor(0);
    this.add.particles(0, 0, 'p-heart', {
      x: { min: 100, max: 1180 }, y: 740, lifespan: 7000, speedY: { min: -60, max: -30 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.5, end: 0.2 }, alpha: { start: 0.7, end: 0 }, frequency: 900, blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0);
    this.add.particles(0, 0, 'firefly', {
      x: { min: 0, max: 1280 }, y: { min: 300, max: 700 }, lifespan: 5000, speed: { min: 5, max: 25 },
      scale: { start: 0.8, end: 0.2 }, alpha: { start: 0, end: 1, ease: 'Sine.easeInOut' }, frequency: 400, blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0);

    this.tweens.add({ targets: [farImg, lightImg], x: -(W - 1280), duration: 40000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.cameras.main.fadeIn(800);
    void flow.title(this);
  }

  private textureOnce(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    if (!this.textures.exists(key)) {
      const [c, ctx] = makeCanvas(w, h);
      draw(ctx);
      this.textures.addCanvas(key, c);
    }
    return key;
  }
}
