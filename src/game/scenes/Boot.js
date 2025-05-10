import { Scene } from 'phaser';

/**
 * @class Boot
 * @extends {Phaser.Scene}
 * @classdesc
 * The initial scene that starts the game. Its sole purpose is to
 * transition to the Preloader scene, ensuring assets are loaded
 *
 * before the main game or menu appears.
 */
export class Boot extends Scene {
  /**
   * Constructs the Boot scene instance.
   *
   * Sets the unique key for this scene, used by Phaser's scene
   * manager.
   */
  constructor() {
    super('Boot');
  }

  /**
   * Phaser scene lifecycle method called once the scene is created.
   *
   * Immediately starts the 'Preloader' scene to handle asset loading.
   * @override
   */
  create() {
    this.scene.start('Preloader');
  }
}
