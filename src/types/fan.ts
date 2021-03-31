
import { OnOff, ScryptedDevice, ScryptedDeviceType } from '@scrypted/sdk'
import { addSupportedType } from '../common'
import { Service } from 'hap-nodejs';
import { probe } from './onoff-base';

addSupportedType({
    type: ScryptedDeviceType.Switch,
    probe: (device: ScryptedDevice & OnOff) => {
        const {accessory, service} = probe(device, Service.Fan);
        return accessory;
    }
});
