import { Brightness, ColorSettingHsv, ColorSettingRgb, ColorSettingTemperature, OnOff, ScryptedDevice, ScryptedDeviceType, ScryptedInterface } from '@scrypted/sdk';
import { addSupportedType, syncResponse } from '../common';

addSupportedType({
    type: ScryptedDeviceType.Switch,
    probe: async (device) => {
        if (!device.interfaces.includes(ScryptedInterface.OnOff))
            return;

        const ret = syncResponse(device, 'action.devices.types.SWITCH');
        ret.traits.push('action.devices.traits.OnOff');

        if (device.interfaces.includes(ScryptedInterface.Brightness))
            ret.traits.push('action.devices.traits.Brightness');
        return ret;
    },
    query: async (device: ScryptedDevice & OnOff & Brightness) => {
        const ret: any = {};
        ret.on = device.on;
        if (device.interfaces.includes(ScryptedInterface.Brightness))
            ret.brightness = device.brightness;
        return ret;
    },
})