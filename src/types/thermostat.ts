
import { ScryptedDevice, ScryptedDeviceType, ScryptedInterface, ScryptedInterfaceProperty, TemperatureSetting, TemperatureUnit, Thermometer, ThermostatMode } from '@scrypted/sdk'
import { addSupportedType, DummyDevice, listenCharacteristic } from '../common'
import { Characteristic, CharacteristicEventTypes, CharacteristicSetCallback, CharacteristicValue, NodeCallback, Service } from 'hap-nodejs';
import { makeAccessory } from './common';
import { CurrentHeatingCoolingState, HumiditySensor, TargetHeatingCoolingState, TemperatureDisplayUnits } from 'hap-nodejs/dist/lib/definitions';

addSupportedType({
    type: ScryptedDeviceType.Thermostat,
    probe(device: DummyDevice) {
        if (!device.interfaces.includes(ScryptedInterface.TemperatureSetting) || !device.interfaces.includes(ScryptedInterface.Thermometer))
            return false;
        return true;
    },
    getAccessory: (device: ScryptedDevice & TemperatureSetting & Thermometer & HumiditySensor) => {
        const accessory = makeAccessory(device);
        const service = accessory.addService(Service.Thermostat, device.name);

        function toCurrentMode(mode: ThermostatMode) {
            switch (mode) {
                case ThermostatMode.Off:
                    return CurrentHeatingCoolingState.OFF;
                case ThermostatMode.Cool:
                    return CurrentHeatingCoolingState.COOL;
                case ThermostatMode.Heat:
                    return CurrentHeatingCoolingState.HEAT;
            }
            return CurrentHeatingCoolingState.HEAT;
        }

        function toTargetMode(mode: ThermostatMode) {
            switch (mode) {
                case ThermostatMode.Off:
                    return TargetHeatingCoolingState.OFF;
                case ThermostatMode.Cool:
                    return TargetHeatingCoolingState.COOL;
                case ThermostatMode.Heat:
                    return TargetHeatingCoolingState.HEAT;
                case ThermostatMode.Auto:
                    return TargetHeatingCoolingState.AUTO;
            }
            return TargetHeatingCoolingState.AUTO;
        }

        function fromTargetMode(mode: number) {
            switch (mode) {
                case TargetHeatingCoolingState.OFF:
                    return ThermostatMode.Off;
                case TargetHeatingCoolingState.HEAT:
                    return ThermostatMode.Heat;
                case TargetHeatingCoolingState.COOL:
                    return ThermostatMode.Cool;
                case TargetHeatingCoolingState.AUTO:
                    return ThermostatMode.Auto;
            }
        }

        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, toCurrentMode(device.thermostatMode));
            });


        let targetMode = toTargetMode(device.thermostatMode);

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, targetMode);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                targetMode = value as number;
                callback();
                device.setThermostatMode(fromTargetMode(targetMode));
            })


        function getTargetTemperature() {
            return device.thermostatSetpoint ||
                ((device.thermostatSetpointHigh + device.thermostatSetpointLow) / 2) ||
                device.temperature;
        }

        service.getCharacteristic(Characteristic.TargetTemperature)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, getTargetTemperature());
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                callback();
                device.setThermostatSetpoint(value as number);
            })

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, device.temperature);
            })

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                callback(null, device.temperatureUnit === TemperatureUnit.C ? TemperatureDisplayUnits.CELSIUS : TemperatureDisplayUnits.FAHRENHEIT);
            })

        device.listen({
            event: ScryptedInterface.TemperatureSetting,
            watch: true,
        }, (source, details, data) => {
            if (details.property === ScryptedInterfaceProperty.thermostatMode) {
                targetMode = toTargetMode(device.thermostatMode);
                service.updateCharacteristic(Characteristic.TargetHeatingCoolingState, targetMode);
            }
            service.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, toCurrentMode(device.thermostatMode));
            service.updateCharacteristic(Characteristic.TargetTemperature, getTargetTemperature());
            service.updateCharacteristic(Characteristic.TemperatureDisplayUnits, device.temperatureUnit === TemperatureUnit.C ? TemperatureDisplayUnits.CELSIUS : TemperatureDisplayUnits.FAHRENHEIT);
        });

        listenCharacteristic(device, ScryptedInterface.Thermometer, service, Characteristic.CurrentTemperature);

        if (device.interfaces.includes(ScryptedInterface.HumiditySensor)) {
            service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
                    callback(null, device.humidity);
                });

            listenCharacteristic(device, ScryptedInterface.HumiditySensor, service, Characteristic.CurrentRelativeHumidity);
        }

        return accessory;
    }
});
