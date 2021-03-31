import sdk, { ScryptedDeviceBase } from '@scrypted/sdk';

const { systemManager, mediaManager } = sdk;
import { Bridge, HAPStorage } from 'hap-nodejs';
import os from 'os';
import { supportedTypes } from './common';
import './types'


HAPStorage.storage();
class HAPLocalStorage {
    initSync(options?: any) {

    }
    getItem(key: string): any {
        const data = localStorage.getItem(key);
        if (!data)
            return;
        return JSON.parse(data);
    }
    setItemSync(key: string, value: any) {
        localStorage.setItem(key, JSON.stringify(value));
    }
    removeItemSync(key: string) {
        localStorage.removeItem(key);
    }

    persistSync() {

    }
}

(HAPStorage as any).INSTANCE.localStore = new HAPLocalStorage();

const mac = os.networkInterfaces()['en2'].find(i => i.family === 'IPv4').mac;

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

if (!localStorage.getItem('uuid')) {
    localStorage.setItem('uuid', uuidv4());
}

const uuid = localStorage.getItem('uuid');



class HomeKit extends ScryptedDeviceBase {
    bridge = new Bridge('Scrypted', uuid);
    constructor() {
        super();

        for (const id of Object.keys(systemManager.getSystemState())) {
            const device = systemManager.getDeviceById(id);
            const accessory = supportedTypes[device.type]?.probe(device);
            if (accessory) {
                this.bridge.addBridgedAccessory(accessory);
            }
        }

        this.bridge.publish({
            username: mac,
            pincode: '123-45-678',
            port: Math.round(Math.random() * 30000 + 10000),
        }, true);
    }
}

export default new HomeKit();
