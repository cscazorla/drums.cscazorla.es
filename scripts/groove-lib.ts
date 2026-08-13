/**
 * Único punto de contacto con el submodule `apps/groove`.
 *
 * `codec.ts` sólo depende de `model.ts`, `voices.ts` y `playback-order.ts`, y
 * ninguno de los cuatro importa paquetes de terceros. Por eso estos imports
 * funcionan bajo `tsx` sin haber ejecutado `npm install` dentro del submodule.
 *
 * Si upstream mueve o renombra ficheros, este es el único fichero a tocar.
 */
export { decode, encode } from '../apps/groove/src/lib/codec'
export { emptyGroove, stepCount } from '../apps/groove/src/lib/model'
export type { Division, Groove, Sticking } from '../apps/groove/src/lib/model'
export { VOICE_IDS } from '../apps/groove/src/lib/voices'
export type { VoiceId } from '../apps/groove/src/lib/voices'
