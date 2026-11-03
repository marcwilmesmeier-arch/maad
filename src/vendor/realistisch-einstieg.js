// Einstieg für das Bibliothekspaket der Darstellung „Realistisch“ (Himmel, Atmosphäre, Wolken, Nachbearbeitung).
// Wird mit `npm run vendor` zu src/vendor/realistisch.js gebündelt (three.js bleibt extern und kommt über die
// Import-Map aus derselben Quelle wie im Hauptprogramm). Nur hier aufgeführte Namen stehen maad zur Verfügung.
export {
  BlendFunction,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
export {
  AerialPerspectiveEffect,
  PrecomputedTexturesGenerator,
  SkyLightProbe,
  SunDirectionalLight,
} from '@takram/three-atmosphere';
export {
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CloudsEffect,
  DEFAULT_LOCAL_WEATHER_URL,
  DEFAULT_SHAPE_DETAIL_URL,
  DEFAULT_SHAPE_URL,
  DEFAULT_TURBULENCE_URL,
} from '@takram/three-clouds';
export {
  DataTextureLoader,
  DEFAULT_STBN_URL,
  Ellipsoid,
  Geodetic,
  parseUint8Array,
  radians,
  STBNLoader,
} from '@takram/three-geospatial';
export { DitheringEffect, LensFlareEffect } from '@takram/three-geospatial-effects';
