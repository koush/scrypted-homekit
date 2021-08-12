
import { Dock, ScryptedDevice, ScryptedDeviceType, ScryptedInterface, StartStop } from '@scrypted/sdk'
import { addSupportedType, DummyDevice, listenCharacteristic } from '../common'
import { Characteristic, CharacteristicEventTypes, CharacteristicSetCallback, CharacteristicValue, NodeCallback, Service } from 'hap-nodejs';
import { makeAccessory } from './common';
import { Active, InUse, ProgramMode } from 'hap-nodejs/dist/lib/definitions';

addSupportedType({
    type: ScryptedDeviceType.Irrigation,
    probe(device: DummyDevice): boolean {
        return device.interfaces.includes(ScryptedInterface.StartStop);
    },
    getAccessory: (device: ScryptedDevice & StartStop) => {
        const accessory = makeAccessory(device);

        const service = accessory.addService(Service.Valve, device.name);
        service.getCharacteristic(Characteristic.Active)
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                callback();
                if (value)
                    device.start();
                else
                    device.stop();
            })
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, !!device.running ? Active.ACTIVE : Active.INACTIVE);
            });

        listenCharacteristic(device, ScryptedInterface.StartStop, service, Characteristic.Active);
        listenCharacteristic(device, ScryptedInterface.StartStop, service, Characteristic.InUse);

        service.getCharacteristic(Characteristic.InUse)
        .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
            callback(null, !!device.running ? InUse.IN_USE : InUse.NOT_IN_USE);
        });


        service.getCharacteristic(Characteristic.ProgramMode)
        .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
            callback(null, ProgramMode.NO_PROGRAM_SCHEDULED);
        });

        service.getCharacteristic(Characteristic.RemainingDuration)
        .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
            callback(null, 1800);
        });

        return accessory;
    }
});
