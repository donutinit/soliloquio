import { describe, expect, it } from 'vitest';
import { gamepadIconName, identifyController, is8BitDoMicro } from './controllerIdentity';

describe('identifyController', () => {
  it('detecta PlayStation por nombre y por vendor id', () => {
    // Chrome
    expect(
      identifyController('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)').family
    ).toBe('playstation');
    // Firefox
    expect(identifyController('054c-05c4-Wireless Controller').family).toBe('playstation');
    // Safari / iOS
    expect(identifyController('DUALSHOCK 4 Wireless Controller Extended Gamepad').family).toBe(
      'playstation'
    );
    expect(identifyController('Sony DualSense Edge').family).toBe('playstation');
  });

  it('detecta Xbox por nombre, XInput y vendor id', () => {
    expect(
      identifyController('Xbox 360 Controller (XInput STANDARD GAMEPAD)').family
    ).toBe('xbox');
    expect(identifyController('Xbox Wireless Controller Extended Gamepad').family).toBe('xbox');
    expect(identifyController('045e-02ea-Microsoft X-Box One S pad').family).toBe('xbox');
  });

  it('detecta Nintendo por nombre y vendor id', () => {
    expect(identifyController('Pro Controller Extended Gamepad').family).toBe('nintendo');
    expect(
      identifyController('Nintendo Switch Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')
        .family
    ).toBe('nintendo');
    expect(identifyController('057e-2006-Joy-Con (L)').family).toBe('nintendo');
  });

  it('detecta 8BitDo incluso cuando se anuncia como Xbox (modo XInput)', () => {
    expect(identifyController('8BitDo SN30 Pro (Vendor: 2dc8 Product: 6001)').family).toBe('8bitdo');
    expect(identifyController('8BitDo Pro 2 (XInput STANDARD GAMEPAD Vendor: 045e)').family).toBe(
      '8bitdo'
    );
    expect(identifyController('2dc8-3106-8BitDo Micro gamepad').family).toBe('8bitdo');
    expect(identifyController('8BitDo Micro gamepad Gamepad').name).toBe(
      '8BitDo Micro controller'
    );
  });

  it('distingue el Micro de otros modelos 8BitDo', () => {
    expect(is8BitDoMicro('8BitDo Micro gamepad Gamepad')).toBe(true);
    expect(is8BitDoMicro('2dc8-3106-8BitDo Micro gamepad')).toBe(true);
    expect(is8BitDoMicro('8BitDo Pro 2')).toBe(false);
    expect(is8BitDoMicro('8BitDo SN30 Pro')).toBe(false);
  });

  it('cae a genérico con ids desconocidos, vacíos o ausentes', () => {
    expect(identifyController('USB Gamepad (Vendor: 0079 Product: 0011)').family).toBe('generic');
    expect(identifyController('')).toEqual({ family: 'generic', name: 'Controller' });
    expect(identifyController(null).family).toBe('generic');
    expect(identifyController(undefined).family).toBe('generic');
  });

  it('devuelve nombres amigables por familia', () => {
    expect(identifyController('DualShock 4').name).toBe('PlayStation controller');
    expect(identifyController('Xbox One pad').name).toBe('Xbox controller');
    expect(identifyController('Joy-Con (R)').name).toBe('Nintendo controller');
    expect(identifyController('8BitDo Zero 2').name).toBe('8BitDo controller');
  });
});

describe('gamepadIconName', () => {
  it('asigna un glifo por familia con fallback genérico', () => {
    expect(gamepadIconName('playstation')).toBe('gamepadPlaystation');
    expect(gamepadIconName('xbox')).toBe('gamepadXbox');
    expect(gamepadIconName('nintendo')).toBe('gamepadNintendo');
    expect(gamepadIconName('8bitdo')).toBe('gamepadRetro');
    expect(gamepadIconName('generic')).toBe('gamepad');
  });
});
