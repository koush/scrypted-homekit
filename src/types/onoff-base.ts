
import { OnOff, ScryptedDevice, ScryptedInterface } from '@scrypted/sdk'
import { uuid, Accessory, Characteristic, CharacteristicEventTypes, CharacteristicSetCallback, CharacteristicValue, Service, NodeCallback } from 'hap-nodejs';
import { makeAccessory } from './common';

export function probe(device: ScryptedDevice & OnOff, serviceType: any): { accessory: Accessory, service: Service } | undefined {
    if (!device.interfaces.includes(ScryptedInterface.OnOff)) {
        return {
            accessory: null,
            service: null,
        };
    }

    const accessory = makeAccessory(device);

    const service = accessory.addService(serviceType, device.name);
    service.getCharacteristic(Characteristic.On)
        .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            callback();
            if (value)
                device.turnOn();
            else
                device.turnOff();
        })
        .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
            callback(null, !!device.on);
        });

    device.listen({
        event: ScryptedInterface.OnOff,
        watch: true,
    }, (source, details, data) => service.updateCharacteristic(Characteristic.On, !!data));

    return {
        accessory,
        service,
    };
}
