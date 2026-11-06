import Phaser from 'phaser';
import { buildBaseTextures } from '../art/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    buildBaseTextures(this);
    this.scene.start('Title');
  }
}
