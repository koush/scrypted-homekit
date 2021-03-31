
import { Lock, LockState, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk'
import { addSupportedType } from '../common'
import { Characteristic, CharacteristicEventTypes, CharacteristicSetCallback, CharacteristicValue, NodeCallback, Service } from 'hap-nodejs';
import { makeAccessory } from './common';
import { LockCurrentState, LockTargetState } from 'hap-nodejs/dist/lib/definitions';

addSupportedType({
    type: ScryptedDeviceType.Lock,
    probe: (device: ScryptedDevice & Lock) => {
        if (!device.interfaces.includes(ScryptedInterface.Lock))
            return;
        const accessory = makeAccessory(device);
        const service = accessory.addService(Service.LockMechanism);

        function toCurrentState(lockState: LockState) {
            switch (lockState) {
                case LockState.Locked:
                    return LockCurrentState.SECURED;
                case LockState.Jammed:
                    return LockCurrentState.JAMMED;
                default:
                    return LockCurrentState.UNSECURED;
            }
        }

        function toTargetState(lockState: LockState) {
            switch (lockState) {
                case LockState.Locked:
                    return LockTargetState.SECURED;
                default:
                    return LockTargetState.UNSECURED;
            }
        }

        service.getCharacteristic(Characteristic.LockCurrentState)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, toCurrentState(device.lockState));
            });


        let targetState = toTargetState(device.lockState);

        service.getCharacteristic(Characteristic.LockTargetState)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, targetState);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                targetState = value as number;
                callback();
                switch (targetState) {
                    case LockTargetState.UNSECURED:
                        device.unlock();
                        break;
                    default:
                        device.lock();
                        break;
                }
            })


        device.listen({
            event: ScryptedInterface.Lock,
            watch: true,
        }, (source, details, data) => {
            targetState = toTargetState(data);
            service.updateCharacteristic(Characteristic.LockTargetState, targetState);
            service.updateCharacteristic(Characteristic.LockCurrentState, toCurrentState(data));
        });

        return accessory;
    }
});
