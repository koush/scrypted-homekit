
import { ScryptedDevice, ScryptedDeviceType } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
import { Accessory } from 'hap-nodejs';

const { systemManager } = sdk;

interface SupportedType {
    type: ScryptedDeviceType;
    probe: (device: ScryptedDevice & any) => Accessory|undefined|void;
}

export const supportedTypes: { [type: string]: SupportedType } = {};

export function addSupportedType(type: SupportedType) {
    supportedTypes[type.type] = type;
}
