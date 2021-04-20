
import { BinarySensor, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk'
import { addSupportedType, DummyDevice } from '../common'
import { Characteristic, CharacteristicEventTypes, CharacteristicValue, NodeCallback, Service } from 'hap-nodejs';
import { makeAccessory } from './common';

addSupportedType({
    type: ScryptedDeviceType.Sensor,
    probe(device: DummyDevice) {
        return device.interfaces.includes(ScryptedInterface.BinarySensor);
    },
    getAccessory: (device: ScryptedDevice & BinarySensor) => {
        const accessory = makeAccessory(device);
        const service = accessory.addService(Service.ContactSensor, device.name);
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
