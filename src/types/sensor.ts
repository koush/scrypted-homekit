
import { BinarySensor, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk'
import { addSupportedType } from '../common'
import { Characteristic, CharacteristicEventTypes, CharacteristicValue, NodeCallback, Service } from 'hap-nodejs';
import { makeAccessory } from './common';

addSupportedType({
    type: ScryptedDeviceType.Sensor,
    probe: (device: ScryptedDevice & BinarySensor) => {
        if (!device.interfaces.includes(ScryptedInterface.BinarySensor))
            return;
        const accessory = makeAccessory(device);
        const service = accessory.addService(Service.ContactSensor);
        service.getCharacteristic(Characteristic.ContactSensorState)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, !!device.binaryState);
            });

        device.listen({
            event: ScryptedInterface.BinarySensor,
            watch: true,
        }, (source, details, data) => service.updateCharacteristic(Characteristic.ContactSensorState, !!data));

        return accessory;
    }
});
