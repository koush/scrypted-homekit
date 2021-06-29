
import { EventListenerRegister, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import sdk from '@scrypted/sdk';
import { Accessory, Characteristic, Service } from 'hap-nodejs';

const { systemManager } = sdk;

export interface DummyDevice {
    interfaces?: string[];
    type?: ScryptedDeviceType;
}

interface SupportedType {
    type: ScryptedDeviceType;
    probe(device: DummyDevice): boolean;
    getAccessory: (device: ScryptedDevice & any) => Accessory;
    noBridge?: boolean;
}

export const supportedTypes: { [type: string]: SupportedType } = {};

export function addSupportedType(type: SupportedType) {
    supportedTypes[type.type] = type;
}

export function listenCharacteristic(device: ScryptedDevice, event: ScryptedInterface, service: Service, characteristic: any): EventListenerRegister {
    return device.listen({
        event,
        watch: true,
    }, (eventSource, eventDetails, data) => {
        service.updateCharacteristic(characteristic, data);
    })
}